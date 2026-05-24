// ─────────────────────────────────────────────────────────────
// AUTH TESTS — register, login, me, admin endpoints,
//              requirePermission middleware, rate limiting,
//              and permission enforcement on product routes.
// Runs against an in-memory SQLite DB (see testSetup.js).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Op } from 'sequelize';
import app from './app.js';
import { User } from './models/index.js';
import authSeed from './authSeed.js';
import { authLimiter } from './rateLimit.js';

const SEEDED_EMAILS = ['admin@estethis.com', 'user@estethis.com'];

beforeAll(async () => {
  await authSeed();
});

beforeEach(async () => {
  // Remove any users created during a test, keep the seeded defaults.
  await User.destroy({ where: { email: { [Op.notIn]: SEEDED_EMAILS } } });
  // Reset the rate-limiter store so tests don't bleed into each other.
  authLimiter._reset();
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

// ── requirePermission middleware ──────────────────────────────

describe('requirePermission middleware', () => {
  it('admin (all perms) can POST a product', async () => {
    const token = await loginAs('admin@estethis.com', 'admin123');
    const res = await request(app)
      .post('/api/products')
      .set('X-Session-Token', token)
      .send({ name: 'Admin Product', price: 50, category: 'Tops' });
    expect(res.status).toBe(201);
  });

  it('user without products:write gets 403 on POST /api/products', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .post('/api/products')
      .set('X-Session-Token', token)
      .send({ name: 'User Product', price: 50, category: 'Tops' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/products:write/);
  });

  it('user without products:write gets 403 on PUT /api/products/:id', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .put('/api/products/1')
      .set('X-Session-Token', token)
      .send({ name: 'Updated', price: 10, category: 'Tops' });
    expect(res.status).toBe(403);
  });

  it('user without products:write gets 403 on DELETE /api/products/:id', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .delete('/api/products/1')
      .set('X-Session-Token', token);
    expect(res.status).toBe(403);
  });

  it('user with products:read can GET /api/products', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .get('/api/products')
      .set('X-Session-Token', token);
    expect(res.status).toBe(200);
  });

  it('unauthenticated GET /api/products gets 401', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('user without generator:manage gets 403 on POST /api/products/generator/start', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .post('/api/products/generator/start')
      .set('X-Session-Token', token)
      .send({});
    expect(res.status).toBe(403);
  });

  it('admin can start the generator', async () => {
    const token = await loginAs('admin@estethis.com', 'admin123');
    // Stop it first to avoid state side-effects, then start
    await request(app)
      .post('/api/products/generator/stop')
      .set('X-Session-Token', token);
    const res = await request(app)
      .post('/api/products/generator/start')
      .set('X-Session-Token', token)
      .send({ intervalMs: 99999 });
    expect(res.status).toBe(200);
    // Clean up
    await request(app)
      .post('/api/products/generator/stop')
      .set('X-Session-Token', token);
  });

  it('error message includes missing permission name', async () => {
    const token = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .post('/api/products')
      .set('X-Session-Token', token)
      .send({ name: 'X', price: 1, category: 'Tops' });
    expect(res.body.error).toContain('products:write');
  });
});

// ── Token security ────────────────────────────────────────────

describe('token security', () => {
  it('empty X-Session-Token header is rejected with 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', '');
    expect(res.status).toBe(401);
  });

  it('malformed token (not a UUID) is rejected with 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', 'not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('token is invalidated after logout', async () => {
    const token = await loginAs('admin@estethis.com', 'admin123');
    await request(app)
      .post('/api/auth/logout')
      .set('X-Session-Token', token);
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', token);
    expect(res.status).toBe(401);
  });

  it('two simultaneous sessions for the same user are independent', async () => {
    const t1 = await loginAs('admin@estethis.com', 'admin123');
    const t2 = await loginAs('admin@estethis.com', 'admin123');
    expect(t1).not.toBe(t2);
    // Logout one — the other should remain valid
    await request(app).post('/api/auth/logout').set('X-Session-Token', t1);
    const res = await request(app).get('/api/auth/me').set('X-Session-Token', t2);
    expect(res.status).toBe(200);
  });

  it('login response does not expose password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/passwordHash|password_hash|bcrypt/i);
  });

  it('register response does not expose password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sectest@test.com', password: 'secret123' });
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/passwordHash|password_hash|bcrypt/i);
  });
});

// ── Rate limiting ─────────────────────────────────────────────

describe('rate limiting on /api/auth/login', () => {
  it('allows requests within the limit', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding max attempts', async () => {
    // The default limiter allows 10 per window.
    // Send 10 valid/invalid requests to exhaust the limit, then the 11th must be 429.
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: `miss${i}@x.com`, password: 'wrong' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many/i);
  });

  it('returns 429 after exceeding max attempts on /api/auth/register', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/register')
        .send({ email: `flood${i}@x.com`, password: 'pass123' });
    }
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'overflow@x.com', password: 'pass123' });
    expect(res.status).toBe(429);
  });

  it('includes Retry-After header in 429 response', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: `ra${i}@x.com`, password: 'wrong' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});

// ── Session payload completeness ──────────────────────────────

describe('session payload returned at login/register', () => {
  it('login payload contains id, email, role, and permissions array', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    const { user } = res.body;
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email', 'admin@estethis.com');
    expect(user).toHaveProperty('role', 'admin');
    expect(Array.isArray(user.permissions)).toBe(true);
    expect(user.permissions.length).toBeGreaterThan(0);
  });

  it('register payload grants only user-level permissions', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newcomer@test.com', password: 'pass1234' });
    const { user } = res.body;
    expect(user.role).toBe('user');
    expect(user.permissions).toContain('products:read');
    expect(user.permissions).not.toContain('products:write');
    expect(user.permissions).not.toContain('users:manage');
    expect(user.permissions).not.toContain('generator:manage');
  });

  it('admin has all expected permissions', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@estethis.com', password: 'admin123' });
    const perms = res.body.user.permissions;
    const expected = [
      'products:read', 'products:write', 'reviews:read', 'reviews:write',
      'stats:read', 'generator:manage', 'users:read', 'users:manage',
    ];
    for (const p of expected) {
      expect(perms).toContain(p);
    }
  });
});
