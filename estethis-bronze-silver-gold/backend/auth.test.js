// ─────────────────────────────────────────────────────────────
// AUTH TESTS — register, login, me, admin endpoints
// Runs against an in-memory SQLite DB (see testSetup.js).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Op } from 'sequelize';
import app from './app.js';
import { User } from './models/index.js';
import authSeed from './authSeed.js';

const SEEDED_EMAILS = ['admin@estethis.com', 'user@estethis.com'];

beforeAll(async () => {
  await authSeed();
});

beforeEach(async () => {
  // Remove any users created during a test, keep the seeded defaults.
  await User.destroy({ where: { email: { [Op.notIn]: SEEDED_EMAILS } } });
});

// ── Helpers ───────────────────────────────────────────────────

async function loginAs(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token;
}

// ── register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('new@test.com');
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.permissions).toContain('products:read');
    expect(res.body.user.permissions).not.toContain('products:write');
  });

  it('stores phone when provided', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'phone@test.com', phone: '+40700000000', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBe('+40700000000');
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@estethis.com', password: 'anything123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('rejects short password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@test.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nopass@test.com' });
    expect(res.status).toBe(400);
  });
});

// ── login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns token for valid admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.permissions).toContain('products:write');
    expect(res.body.user.permissions).toContain('users:manage');
  });

  it('returns restricted permissions for regular user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@estethis.com', password: 'user123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.permissions).toContain('products:read');
    expect(res.body.user.permissions).not.toContain('products:write');
    expect(res.body.user.permissions).not.toContain('users:manage');
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'pass123' });
    expect(res.status).toBe(401);
  });
});

// ── me ────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns user payload for valid token', async () => {
    const token = await loginAs('admin@estethis.com', 'admin123');
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', token);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@estethis.com');
    expect(res.body.role).toBe('admin');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ── logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('invalidates the session token', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    await request(app)
      .post('/api/auth/logout')
      .set('X-Session-Token', token);
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', token);
    expect(res.status).toBe(401);
  });
});

// ── admin: list users ─────────────────────────────────────────

describe('GET /api/auth/users', () => {
  it('admin can list all users', async () => {
    const token = await loginAs('admin@estethis.com', 'admin123');
    const res = await request(app)
      .get('/api/auth/users')
      .set('X-Session-Token', token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.some(u => u.email === 'admin@estethis.com')).toBe(true);
    expect(res.body.every(u => u.role !== undefined)).toBe(true);
  });

  it('regular user gets 403', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .get('/api/auth/users')
      .set('X-Session-Token', token);
    expect(res.status).toBe(403);
  });

  it('unauthenticated request gets 401', async () => {
    const res = await request(app).get('/api/auth/users');
    expect(res.status).toBe(401);
  });
});

// ── admin: delete user ────────────────────────────────────────

describe('DELETE /api/auth/users/:id', () => {
  it('admin can delete another user', async () => {
    const created = await request(app)
      .post('/api/auth/register')
      .send({ email: 'todelete@test.com', password: 'pass123' });
    const userId = created.body.user.id;

    const token = await loginAs('admin@estethis.com', 'admin123');
    const res = await request(app)
      .delete(`/api/auth/users/${userId}`)
      .set('X-Session-Token', token);
    expect(res.status).toBe(204);
  });

  it('admin cannot delete themselves', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    const { token, user } = loginRes.body;

    const res = await request(app)
      .delete(`/api/auth/users/${user.id}`)
      .set('X-Session-Token', token);
    expect(res.status).toBe(400);
  });

  it('regular user gets 403', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .delete('/api/auth/users/999')
      .set('X-Session-Token', token);
    expect(res.status).toBe(403);
  });
});
