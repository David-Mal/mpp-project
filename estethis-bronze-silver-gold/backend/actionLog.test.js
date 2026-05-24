// ─────────────────────────────────────────────────────────────
// ACTION LOG TESTS (Step 3 — Gold)
// Verifies that every authenticated action is persisted with the
// correct USER_ID, GROUP_ID, ACTION_INFORMATION, and TIMESTAMP.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Op } from 'sequelize';
import app from './app.js';
import { ActionLog, User } from './models/index.js';
import authSeed from './authSeed.js';
import { authLimiter } from './rateLimit.js';

const SEEDED_EMAILS = ['admin@estethis.com', 'manager@estethis.com', 'user@estethis.com'];

beforeAll(async () => {
  await authSeed();
});

beforeEach(async () => {
  await ActionLog.destroy({ where: {} });
  await User.destroy({ where: { email: { [Op.notIn]: SEEDED_EMAILS } } });
  authLimiter._reset(); // prevent rate-limit bleed between tests
});

// ── Helpers ───────────────────────────────────────────────────

async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { token: res.body.token, user: res.body.user };
}

/** Wait briefly for the `res.on('finish')` async log to be written. */
const settle = () => new Promise(r => setTimeout(r, 60));

// ── Login / Register logging ──────────────────────────────────

describe('Login & Register logging', () => {
  it('logs a successful login with correct fields', async () => {
    await request(app).post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    await settle();

    const logs = await ActionLog.findAll({ order: [['id', 'DESC']], limit: 5 });
    const loginLog = logs.find(l => l.actionInfo.includes('Logged in'));
    expect(loginLog).toBeTruthy();
    expect(loginLog.groupId).toBe('admin');
    expect(loginLog.userId).toBeTypeOf('number');
    expect(loginLog.createdAt).toBeInstanceOf(Date);
  });

  it('logs a successful registration', async () => {
    await request(app).post('/api/auth/register')
      .send({ email: 'newuser@test.com', password: 'pass123' });
    await settle();

    const log = await ActionLog.findOne({
      where: { actionInfo: { [Op.like]: '%Registered%newuser@test.com%' } },
    });
    expect(log).toBeTruthy();
    expect(log.groupId).toBe('user');
    expect(log.createdAt).toBeInstanceOf(Date);
  });

  it('does NOT log a failed login (wrong password)', async () => {
    const before = await ActionLog.count();
    await request(app).post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'WRONG' });
    await settle();
    expect(await ActionLog.count()).toBe(before);
  });
});

// ── Middleware logging for authenticated requests ─────────────

describe('Middleware logging', () => {
  it('logs GET /api/auth/me for an authenticated user', async () => {
    const { token, user } = await loginAs('user@estethis.com', 'user123');
    await ActionLog.destroy({ where: {} }); // reset after login log

    await request(app).get('/api/auth/me').set('X-Session-Token', token);
    await settle();

    const log = await ActionLog.findOne({
      where: { userId: user.id, actionInfo: { [Op.like]: '%profile%' } },
    });
    expect(log).toBeTruthy();
    expect(log.groupId).toBe('user');
  });

  it('logs product listing for an authenticated user', async () => {
    const { token, user } = await loginAs('user@estethis.com', 'user123');
    await ActionLog.destroy({ where: {} });

    await request(app).get('/api/products').set('X-Session-Token', token);
    await settle();

    const log = await ActionLog.findOne({ where: { userId: user.id } });
    expect(log).toBeTruthy();
    expect(log.actionInfo).toMatch(/Listed products/i);
    expect(log.groupId).toBe('user');
  });

  it('does NOT log requests from unauthenticated visitors', async () => {
    const before = await ActionLog.count();
    await request(app).get('/api/products'); // no token
    await settle();
    expect(await ActionLog.count()).toBe(before);
  });

  it('logs logout correctly', async () => {
    const { token, user } = await loginAs('admin@estethis.com', 'admin123');
    await ActionLog.destroy({ where: {} });

    await request(app).post('/api/auth/logout').set('X-Session-Token', token);
    await settle();

    const log = await ActionLog.findOne({ where: { userId: user.id } });
    expect(log?.actionInfo).toBe('Logged out');
    expect(log?.groupId).toBe('admin');
  });
});

// ── Log entry field schema ────────────────────────────────────

describe('ActionLog schema', () => {
  it('every log entry has USER_ID, GROUP_ID, ACTION_INFORMATION, TIMESTAMP', async () => {
    const { token } = await loginAs('admin@estethis.com', 'admin123');
    await ActionLog.destroy({ where: {} });

    await request(app).get('/api/auth/users').set('X-Session-Token', token);
    await settle();

    const log = await ActionLog.findOne({ order: [['id', 'DESC']] });
    expect(log).toBeTruthy();
    expect(log.userId).toBeTypeOf('number');        // USER_ID
    expect(log.groupId).toBe('admin');              // GROUP_ID
    expect(log.actionInfo).toBeTypeOf('string');    // ACTION_INFORMATION
    expect(log.createdAt).toBeInstanceOf(Date);     // TIMESTAMP
  });

  it('admin actions have groupId="admin", user actions have groupId="user"', async () => {
    const { token: adminTok, user: adminUser } = await loginAs('admin@estethis.com', 'admin123');
    const { token: userTok,  user: normalUser } = await loginAs('user@estethis.com',  'user123');
    await ActionLog.destroy({ where: {} });

    await request(app).get('/api/auth/me').set('X-Session-Token', adminTok);
    await request(app).get('/api/auth/me').set('X-Session-Token', userTok);
    await settle();

    const adminLog = await ActionLog.findOne({ where: { userId: adminUser.id } });
    const userLog  = await ActionLog.findOne({ where: { userId: normalUser.id } });
    expect(adminLog?.groupId).toBe('admin');
    expect(userLog?.groupId).toBe('user');
  });
});

// ── Admin logs endpoint ───────────────────────────────────────

describe('GET /api/admin/logs', () => {
  it('admin can retrieve paginated action logs', async () => {
    const { token } = await loginAs('admin@estethis.com', 'admin123');
    // Generate some logs
    await request(app).get('/api/auth/me').set('X-Session-Token', token);
    await settle();

    const res = await request(app)
      .get('/api/admin/logs?page=1&limit=20')
      .set('X-Session-Token', token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);

    const entry = res.body.data[0];
    expect(entry).toHaveProperty('userId');
    expect(entry).toHaveProperty('groupId');
    expect(entry).toHaveProperty('actionInfo');
    expect(entry).toHaveProperty('createdAt');
  });

  it('can filter logs by groupId', async () => {
    const { token: adminTok } = await loginAs('admin@estethis.com', 'admin123');
    const { token: userTok  } = await loginAs('user@estethis.com',  'user123');
    await ActionLog.destroy({ where: {} });

    await request(app).get('/api/auth/me').set('X-Session-Token', adminTok);
    await request(app).get('/api/auth/me').set('X-Session-Token', userTok);
    await settle();

    const res = await request(app)
      .get('/api/admin/logs?groupId=admin')
      .set('X-Session-Token', adminTok);
    expect(res.status).toBe(200);
    expect(res.body.data.every(l => l.groupId === 'admin')).toBe(true);
  });

  it('regular user cannot access logs (403)', async () => {
    const { token } = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .get('/api/admin/logs')
      .set('X-Session-Token', token);
    expect(res.status).toBe(403);
  });

  it('unauthenticated request is rejected (401)', async () => {
    const res = await request(app).get('/api/admin/logs');
    expect(res.status).toBe(401);
  });
});
