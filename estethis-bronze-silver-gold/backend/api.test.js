// ─────────────────────────────────────────────────────────────
// API TESTS — full coverage of all REST endpoints
// Uses supertest (in-process HTTP) + vitest globals.
// The DB is SQLite :memory:, synced fresh in testSetup.js.
//
// All routes now require authentication; we obtain an admin token
// once in beforeAll and attach it via X-Session-Token.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request    from 'supertest';
import app        from './app.js';
import repository from './repository.js';
import authSeed   from './authSeed.js';

let adminToken;
let userToken;

// Seed roles/users once, then get tokens for both admin and regular user.
beforeAll(async () => {
  await authSeed();

  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@estethis.com', password: 'admin123' });
  adminToken = adminRes.body.token;

  const userRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@estethis.com', password: 'user123' });
  userToken = userRes.body.token;
});

// Reset product data before every test
beforeEach(async () => {
  await repository.clear();
});

// Convenience helpers
const asAdmin = (req) => req.set('X-Session-Token', adminToken);
const asUser  = (req) => req.set('X-Session-Token', userToken);

const VALID = { name: 'Test Shirt', price: 99, category: 'Tops', stock: 5, colors: ['White'], sizes: ['M'] };

// ── POST /api/products ────────────────────────────────────────

describe('POST /api/products — creare produs', () => {
  it('admin creează un produs valid și returnează 201', async () => {
    const res = await asAdmin(request(app).post('/api/products').send(VALID));
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ name: 'Test Shirt', price: 99, category: 'Tops' });
  });

  it('user fără products:write primește 403', async () => {
    const res = await asUser(request(app).post('/api/products').send(VALID));
    expect(res.statusCode).toBe(403);
  });

  it('cerere neautentificată primește 401', async () => {
    const res = await request(app).post('/api/products').send(VALID);
    expect(res.statusCode).toBe(401);
  });

  it('returnează 400 când lipsește name', async () => {
    const res = await asAdmin(request(app).post('/api/products').send({ price: 50, category: 'Tops' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returnează 400 când price este negativ', async () => {
    const res = await asAdmin(request(app).post('/api/products').send({ name: 'X', price: -1, category: 'Tops' }));
    expect(res.statusCode).toBe(400);
  });

  it('returnează 400 când category este invalidă', async () => {
    const res = await asAdmin(request(app).post('/api/products').send({ name: 'X', price: 10, category: 'InvalidCat' }));
    expect(res.statusCode).toBe(400);
  });

  it('returnează 400 când name este prea scurt', async () => {
    const res = await asAdmin(request(app).post('/api/products').send({ name: 'A', price: 10, category: 'Tops' }));
    expect(res.statusCode).toBe(400);
  });

  it('salvează câmpurile opționale (colors, sizes, stock)', async () => {
    const res = await asAdmin(request(app).post('/api/products').send(VALID));
    expect(res.body.colors).toEqual(['White']);
    expect(res.body.sizes).toEqual(['M']);
    expect(res.body.stock).toBe(5);
  });
});

// ── GET /api/products ─────────────────────────────────────────

describe('GET /api/products — listare paginată', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 5; i++) {
      await repository.create({ name: `Produs ${i}`, price: i * 10, category: 'Tops' });
    }
  });

  it('returnează prima pagină cu limita implicită (admin)', async () => {
    const res = await asAdmin(request(app).get('/api/products'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 5);
    expect(res.body).toHaveProperty('page', 1);
  });

  it('returnează prima pagină cu limita implicită (user)', async () => {
    const res = await asUser(request(app).get('/api/products'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('total', 5);
  });

  it('cerere neautentificată primește 401', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(401);
  });

  it('paginează corect cu page=1&limit=2', async () => {
    const res = await asAdmin(request(app).get('/api/products?page=1&limit=2'));
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.limit).toBe(2);
  });

  it('returnează a doua pagină corect', async () => {
    const res = await asAdmin(request(app).get('/api/products?page=2&limit=2'));
    expect(res.body.data).toHaveLength(2);
    expect(res.body.page).toBe(2);
  });

  it('returnează pagina goală dacă depășim totalul', async () => {
    const res = await asAdmin(request(app).get('/api/products?page=99&limit=10'));
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(5);
  });
});

// ── GET /api/products/:id ─────────────────────────────────────

describe('GET /api/products/:id — produs după ID', () => {
  it('returnează produsul existent', async () => {
    await repository.create({ name: 'Bluza', price: 50, category: 'Tops' });
    const res = await asAdmin(request(app).get('/api/products/1'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('name', 'Bluza');
  });

  it('user poate citi un produs', async () => {
    await repository.create({ name: 'Bluza', price: 50, category: 'Tops' });
    const res = await asUser(request(app).get('/api/products/1'));
    expect(res.statusCode).toBe(200);
  });

  it('returnează 404 pentru ID inexistent', async () => {
    const res = await asAdmin(request(app).get('/api/products/999'));
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('cerere neautentificată primește 401', async () => {
    const res = await request(app).get('/api/products/1');
    expect(res.statusCode).toBe(401);
  });
});

// ── PUT /api/products/:id ─────────────────────────────────────

describe('PUT /api/products/:id — actualizare produs', () => {
  it('admin actualizează un produs existent', async () => {
    await repository.create({ name: 'Vechi', price: 10, category: 'Tops' });
    const res = await asAdmin(
      request(app).put('/api/products/1').send({ name: 'Nou', price: 20, category: 'Bottoms' }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ name: 'Nou', price: 20, category: 'Bottoms' });
  });

  it('user fără products:write primește 403', async () => {
    await repository.create({ name: 'Vechi', price: 10, category: 'Tops' });
    const res = await asUser(
      request(app).put('/api/products/1').send({ name: 'Nou', price: 20, category: 'Bottoms' }),
    );
    expect(res.statusCode).toBe(403);
  });

  it('returnează 404 pentru ID inexistent', async () => {
    const res = await asAdmin(
      request(app).put('/api/products/999').send({ name: 'Produs Valid', price: 10, category: 'Tops' }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('returnează 400 pentru date invalide la update', async () => {
    await repository.create({ name: 'Produs', price: 10, category: 'Tops' });
    const res = await asAdmin(
      request(app).put('/api/products/1').send({ name: '', price: 10, category: 'Tops' }),
    );
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /api/products/:id ──────────────────────────────────

describe('DELETE /api/products/:id — ștergere produs', () => {
  it('admin șterge un produs și returnează 204', async () => {
    await repository.create({ name: 'De sters', price: 5, category: 'Tops' });
    const res = await asAdmin(request(app).delete('/api/products/1'));
    expect(res.statusCode).toBe(204);

    const verify = await asAdmin(request(app).get('/api/products/1'));
    expect(verify.statusCode).toBe(404);
  });

  it('user fără products:write primește 403', async () => {
    await repository.create({ name: 'De sters', price: 5, category: 'Tops' });
    const res = await asUser(request(app).delete('/api/products/1'));
    expect(res.statusCode).toBe(403);
  });

  it('returnează 404 pentru ID inexistent', async () => {
    const res = await asAdmin(request(app).delete('/api/products/999'));
    expect(res.statusCode).toBe(404);
  });

  it('cerere neautentificată primește 401', async () => {
    const res = await request(app).delete('/api/products/1');
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /api/products/stats ───────────────────────────────────

describe('GET /api/products/stats — statistici', () => {
  it('returnează statistici corecte pe categorii', async () => {
    await repository.create({ name: 'A', price: 100, category: 'Tops',    stock: 5 });
    await repository.create({ name: 'B', price: 200, category: 'Tops',    stock: 3 });
    await repository.create({ name: 'C', price: 50,  category: 'Bottoms', stock: 2 });

    const res = await asAdmin(request(app).get('/api/products/stats'));
    expect(res.statusCode).toBe(200);
    expect(res.body.byCategory).toEqual({ Tops: 2, Bottoms: 1 });
    expect(res.body.totalProducts).toBe(3);
    expect(res.body.totalStock).toBe(10);
  });

  it('user poate citi statistici', async () => {
    const res = await asUser(request(app).get('/api/products/stats'));
    expect(res.statusCode).toBe(200);
  });

  it('returnează statistici goale când nu există produse', async () => {
    const res = await asAdmin(request(app).get('/api/products/stats'));
    expect(res.statusCode).toBe(200);
    expect(res.body.totalProducts).toBe(0);
    expect(res.body.byCategory).toEqual({});
  });

  it('cerere neautentificată primește 401', async () => {
    const res = await request(app).get('/api/products/stats');
    expect(res.statusCode).toBe(401);
  });
});
