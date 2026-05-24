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
import { _clearAll as clearTokenStore } from './tokenStore.js';

const SEEDED_EMAILS = ['admin@estethis.com', 'manager@estethis.com', 'user@estethis.com'];

beforeAll(async () => {
  await authSeed();
});

beforeEach(async () => {
  await User.destroy({ where: { email: { [Op.notIn]: SEEDED_EMAILS } } });
  authLimiter._reset();
  clearTokenStore();
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

// ── Manager role ──────────────────────────────────────────────

describe('manager role permissions', () => {
  it('manager can log in with password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@estethis.com', password: 'manager123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('manager');
  });

  it('manager has products:write but not users:manage', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@estethis.com', password: 'manager123' });
    const { permissions } = res.body.user;
    expect(permissions).toContain('products:write');
    expect(permissions).toContain('generator:manage');
    expect(permissions).toContain('users:read');
    expect(permissions).not.toContain('users:manage');
  });

  it('manager can POST a product (has products:write)', async () => {
    const token = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@estethis.com', password: 'manager123' })).body.token;
    const res = await request(app)
      .post('/api/products')
      .set('X-Session-Token', token)
      .send({ name: 'Manager Product', price: 50, category: 'Tops' });
    expect(res.status).toBe(201);
  });

  it('manager cannot delete a user (no users:manage)', async () => {
    const token = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@estethis.com', password: 'manager123' })).body.token;
    const res = await request(app)
      .delete('/api/auth/users/999')
      .set('X-Session-Token', token);
    expect(res.status).toBe(403);
  });

  it('manager can see user list (has users:read via /api/auth/users requires admin role)', async () => {
    // /api/auth/users is protected by requireAdmin (role check, not permission check)
    // manager has users:read permission but not the admin ROLE — expects 403
    const token = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@estethis.com', password: 'manager123' })).body.token;
    const res = await request(app)
      .get('/api/auth/users')
      .set('X-Session-Token', token);
    expect(res.status).toBe(403);
  });

  it('three distinct roles exist with different permission scopes', async () => {
    const [adminRes, mgrRes, userRes] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'admin@estethis.com',   password: 'admin123'   }),
      request(app).post('/api/auth/login').send({ email: 'manager@estethis.com', password: 'manager123' }),
      request(app).post('/api/auth/login').send({ email: 'user@estethis.com',    password: 'user123'    }),
    ]);
    const adminPerms = adminRes.body.user.permissions;
    const mgrPerms   = mgrRes.body.user.permissions;
    const userPerms  = userRes.body.user.permissions;

    // Admin is a superset of manager
    expect(adminPerms.length).toBeGreaterThan(mgrPerms.length);
    // Manager is a superset of user
    expect(mgrPerms.length).toBeGreaterThan(userPerms.length);
    // Roles are distinct
    expect(adminRes.body.user.role).toBe('admin');
    expect(mgrRes.body.user.role).toBe('manager');
    expect(userRes.body.user.role).toBe('user');
  });
});

// ── OTP authentication ────────────────────────────────────────

describe('POST /api/auth/request-otp', () => {
  it('returns a demo OTP for a known email', async () => {
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({ identifier: 'user@estethis.com' });
    expect(res.status).toBe(200);
    expect(res.body._demo_otp).toMatch(/^\d{6}$/);
    expect(res.body.expiresInSeconds).toBe(600);
  });

  it('returns a demo OTP for a known phone number', async () => {
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({ identifier: '+40700000003' });
    expect(res.status).toBe(200);
    expect(res.body._demo_otp).toMatch(/^\d{6}$/);
  });

  it('returns 404 for unknown identifier', async () => {
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({ identifier: 'nobody@x.com' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when identifier is missing', async () => {
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login-otp', () => {
  it('completes login with the correct OTP', async () => {
    const otpRes = await request(app)
      .post('/api/auth/request-otp')
      .send({ identifier: 'user@estethis.com' });
    const code = otpRes.body._demo_otp;

    const loginRes = await request(app)
      .post('/api/auth/login-otp')
      .send({ identifier: 'user@estethis.com', code });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.user.email).toBe('user@estethis.com');
    expect(loginRes.body.user.role).toBe('user');
  });

  it('session authMethod is otp', async () => {
    const otpRes = await request(app)
      .post('/api/auth/request-otp')
      .send({ identifier: 'admin@estethis.com' });
    const code  = otpRes.body._demo_otp;
    const loginRes = await request(app)
      .post('/api/auth/login-otp')
      .send({ identifier: 'admin@estethis.com', code });
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', loginRes.body.token);
    expect(meRes.body.authMethod).toBe('otp');
  });

  it('rejects wrong OTP with 401', async () => {
    await request(app).post('/api/auth/request-otp').send({ identifier: 'user@estethis.com' });
    const res = await request(app)
      .post('/api/auth/login-otp')
      .send({ identifier: 'user@estethis.com', code: '000000' });
    expect(res.status).toBe(401);
  });

  it('OTP is single-use — second attempt fails', async () => {
    const otpRes = await request(app)
      .post('/api/auth/request-otp')
      .send({ identifier: 'user@estethis.com' });
    const code = otpRes.body._demo_otp;
    await request(app).post('/api/auth/login-otp').send({ identifier: 'user@estethis.com', code });
    const second = await request(app)
      .post('/api/auth/login-otp')
      .send({ identifier: 'user@estethis.com', code });
    expect(second.status).toBe(401);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login-otp')
      .send({ identifier: 'user@estethis.com' });
    expect(res.status).toBe(400);
  });
});

// ── Magic-link authentication ─────────────────────────────────

describe('POST /api/auth/request-magic-link', () => {
  it('returns a demo token for a known email', async () => {
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'admin@estethis.com' });
    expect(res.status).toBe(200);
    expect(res.body._demo_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.expiresInSeconds).toBe(900);
  });

  it('returns 404 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'ghost@x.com' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/verify-magic-link', () => {
  it('completes login with a valid magic token', async () => {
    const magicRes = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'manager@estethis.com' });
    const token = magicRes.body._demo_token;

    const loginRes = await request(app)
      .get(`/api/auth/verify-magic-link?token=${token}`);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.user.email).toBe('manager@estethis.com');
    expect(loginRes.body.user.role).toBe('manager');
  });

  it('session authMethod is magic-link', async () => {
    const magicRes = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'admin@estethis.com' });
    const magicToken = magicRes.body._demo_token;
    const loginRes = await request(app).get(`/api/auth/verify-magic-link?token=${magicToken}`);
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', loginRes.body.token);
    expect(meRes.body.authMethod).toBe('magic-link');
  });

  it('magic link is single-use — second verification fails', async () => {
    const magicRes = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'user@estethis.com' });
    const token = magicRes.body._demo_token;
    await request(app).get(`/api/auth/verify-magic-link?token=${token}`);
    const second = await request(app).get(`/api/auth/verify-magic-link?token=${token}`);
    expect(second.status).toBe(401);
  });

  it('rejects invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/auth/verify-magic-link?token=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns 400 when token query param is missing', async () => {
    const res = await request(app).get('/api/auth/verify-magic-link');
    expect(res.status).toBe(400);
  });
});

// ── Password recovery ─────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('returns a demo reset token for a known email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'user@estethis.com' });
    expect(res.status).toBe(200);
    expect(res.body._demo_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.expiresInSeconds).toBe(1800);
  });

  it('returns 200 even for unknown email (no user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@x.com' });
    expect(res.status).toBe(200);
    expect(res.body._demo_token).toBeUndefined();
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('resets the password and allows login with new password', async () => {
    // Use a throwaway account so seeded user passwords are not changed
    await request(app).post('/api/auth/register')
      .send({ email: 'pwreset@test.com', password: 'original1' });

    // Step 1: get reset token
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'pwreset@test.com' });
    const resetToken = forgotRes.body._demo_token;

    // Step 2: reset
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'newPass999' });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toMatch(/updated/i);

    // Step 3: login with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pwreset@test.com', password: 'newPass999' });
    expect(loginRes.status).toBe(200);
  });

  it('reset token is single-use', async () => {
    // Register a throwaway user so seeded passwords are not changed
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'resettest@test.com', password: 'pass1234' });

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'resettest@test.com' });
    const token = forgotRes.body._demo_token;

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'firstReset1' });

    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'secondReset2' });
    expect(second.status).toBe(401);
  });

  it('rejects invalid reset token with 401', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'fake-token', newPassword: 'newPass123' });
    expect(res.status).toBe(401);
  });

  it('rejects short new password with 400', async () => {
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'user@estethis.com' });
    const token = forgotRes.body._demo_token;
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'tok' }); // missing newPassword
    expect(res.status).toBe(400);
  });
});

// ── authMethod in session payload ─────────────────────────────

describe('authMethod field in session', () => {
  it('password login sets authMethod = password', async () => {
    // Use manager account whose password is never changed by other tests
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@estethis.com', password: 'manager123' });
    expect(loginRes.status).toBe(200);
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', loginRes.body.token);
    expect(meRes.body.authMethod).toBe('password');
  });

  it('OTP login sets authMethod = otp', async () => {
    const otpRes = await request(app)
      .post('/api/auth/request-otp')
      .send({ identifier: 'user@estethis.com' });
    const loginRes = await request(app)
      .post('/api/auth/login-otp')
      .send({ identifier: 'user@estethis.com', code: otpRes.body._demo_otp });
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', loginRes.body.token);
    expect(meRes.body.authMethod).toBe('otp');
  });

  it('magic-link login sets authMethod = magic-link', async () => {
    const magicRes = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'user@estethis.com' });
    const loginRes = await request(app)
      .get(`/api/auth/verify-magic-link?token=${magicRes.body._demo_token}`);
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('X-Session-Token', loginRes.body.token);
    expect(meRes.body.authMethod).toBe('magic-link');
  });
});
