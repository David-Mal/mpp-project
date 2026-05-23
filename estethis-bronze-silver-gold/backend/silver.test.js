// ─────────────────────────────────────────────────────────────
// SILVER BACKEND TESTS
// Covers: generator, /sync endpoint, WebSocket broadcaster.
// All repository calls are async (SQLite-backed).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http       from 'node:http';
import { WebSocket } from 'ws';
import request    from 'supertest';

import app         from './app.js';
import repository  from './repository.js';
import * as gen    from './generator.js';
import { fakeProduct } from './generator.js';
import { events, EVENTS } from './events.js';
import { attach as attachRealtime } from './realtime.js';

beforeEach(async () => {
  await repository.clear();
  gen.reset();
});

afterEach(() => {
  gen.reset();
});

// ─────────────────────────────────────────────────────────────
//  FAKER GENERATOR (unit)
// ─────────────────────────────────────────────────────────────
describe('generator › fakeProduct()', () => {
  it('produces a product that satisfies the validator (50/50 random samples)', async () => {
    const { validateProduct } = await import('./validator.js');
    for (let i = 0; i < 50; i++) {
      const fake = fakeProduct();
      let calledNext = false;
      let captured   = null;
      validateProduct(
        { body: fake },
        { status(c) { captured = { code: c }; return this; }, json() { return this; } },
        () => { calledNext = true; },
      );
      expect(calledNext, `validation failed for ${JSON.stringify(fake)} — captured=${JSON.stringify(captured)}`).toBe(true);
    }
  });
});

describe('generator › state machine', () => {
  it('tickOnce(n) inserts n products and emits a batch event', async () => {
    const events_received = [];
    const off = (b) => events_received.push(b);
    events.on(EVENTS.PRODUCT_BATCH, off);

    const before  = (await repository.getAll(1, 1)).total;
    const created = await gen.tickOnce(4);

    events.off(EVENTS.PRODUCT_BATCH, off);

    expect(created).toHaveLength(4);
    expect((await repository.getAll(1, 999)).total).toBe(before + 4);
    expect(events_received).toHaveLength(1);
    expect(events_received[0]).toHaveLength(4);
  });

  it('status() reflects start / stop', () => {
    expect(gen.status().running).toBe(false);
    gen.start({ intervalMs: 5000, batchSize: 2 });
    expect(gen.status().running).toBe(true);
    gen.stop();
    expect(gen.status().running).toBe(false);
  });

  it('rejects intervalMs below the safety floor', () => {
    expect(() => gen.start({ intervalMs: 10 })).toThrow();
  });

  it('rejects oversize batchSize', () => {
    expect(() => gen.start({ batchSize: 9999 })).toThrow();
  });

  it('start() is idempotent — second call keeps the same timer', () => {
    gen.start({ intervalMs: 5000 });
    const a = gen.status();
    const b = gen.start({});
    expect(b.running).toBe(true);
    expect(a.startedAt).toBe(b.startedAt);
  });

  it('a running loop generates items over time', async () => {
    const before = (await repository.getAll(1, 999)).total;
    gen.start({ intervalMs: 250, batchSize: 2 });
    await new Promise((r) => setTimeout(r, 800));
    gen.stop();
    // Give any in-flight async DB writes a moment to land
    await new Promise((r) => setTimeout(r, 150));
    expect((await repository.getAll(1, 999)).total).toBeGreaterThan(before);
  });
});

// ─────────────────────────────────────────────────────────────
//  GENERATOR REST ENDPOINTS
// ─────────────────────────────────────────────────────────────
describe('REST › /api/products/generator', () => {
  it('GET returns current status', async () => {
    const res = await request(app).get('/api/products/generator');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('running', false);
    expect(res.body).toHaveProperty('intervalMs');
    expect(res.body).toHaveProperty('batchSize');
  });

  it('POST /start then /stop toggles the loop', async () => {
    const start = await request(app)
      .post('/api/products/generator/start')
      .send({ intervalMs: 5000, batchSize: 2 });
    expect(start.status).toBe(200);
    expect(start.body.running).toBe(true);

    const stop = await request(app).post('/api/products/generator/stop');
    expect(stop.body.running).toBe(false);
  });

  it('POST /tick fires one batch immediately', async () => {
    const res = await request(app)
      .post('/api/products/generator/tick')
      .send({ batchSize: 3 });
    expect(res.status).toBe(200);
    expect(res.body.generated).toBe(3);
    expect(res.body.items).toHaveLength(3);
  });

  it('POST /start with bad params returns 400', async () => {
    const res = await request(app)
      .post('/api/products/generator/start')
      .send({ intervalMs: 5 });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
//  /sync ENDPOINT
// ─────────────────────────────────────────────────────────────
describe('REST › /api/products/sync', () => {
  it('replays a mixed batch and returns per-op outcomes', async () => {
    const seed = await request(app)
      .post('/api/products')
      .send({ name: 'Original', price: 50, category: 'Tops', stock: 1, colors: ['White'], sizes: ['M'] });
    expect(seed.status).toBe(201);
    const seedId = seed.body.id;

    const ops = [
      { op: 'create', clientId: 'tmp-1',
        payload: { name: 'From offline 1', price: 100, category: 'Bottoms', stock: 5, colors: ['Black'], sizes: ['M'] } },
      { op: 'update', id: seedId,
        payload: { name: 'Renamed', price: 99, category: 'Tops', stock: 1, colors: ['White'], sizes: ['M'] } },
      { op: 'create', clientId: 'tmp-2',
        payload: { name: '', price: 1, category: 'Tops' } },
      { op: 'delete', id: 999 },
    ];

    const res = await request(app).post('/api/products/sync').send({ operations: ops });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(4);

    expect(res.body.results[0]).toMatchObject({ ok: true,  op: 'create', clientId: 'tmp-1' });
    expect(res.body.results[1]).toMatchObject({ ok: true,  op: 'update' });
    expect(res.body.results[2]).toMatchObject({ ok: false, op: 'create', status: 400 });
    expect(res.body.results[3]).toMatchObject({ ok: false, op: 'delete', status: 404 });

    expect(res.body.applied).toBe(2);
    expect(res.body.failed).toBe(2);
  });

  it('handles unknown ops gracefully', async () => {
    const res = await request(app)
      .post('/api/products/sync')
      .send({ operations: [{ op: 'banana' }] });
    expect(res.status).toBe(200);
    expect(res.body.results[0].ok).toBe(false);
  });

  it('empty operations list returns zero results', async () => {
    const res = await request(app).post('/api/products/sync').send({ operations: [] });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(0);
    expect(res.body.failed).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  HEALTH ENDPOINT
// ─────────────────────────────────────────────────────────────
describe('REST › /api/health', () => {
  it('returns ok with generator status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('generator');
  });
});

// ─────────────────────────────────────────────────────────────
//  WEBSOCKET BROADCASTER (real-server end-to-end)
// ─────────────────────────────────────────────────────────────
describe('WebSocket broadcaster', () => {
  let server, realtime, port;

  beforeEach(async () => {
    server   = http.createServer(app);
    realtime = attachRealtime({ httpServer: server });
    await new Promise((r) => server.listen(0, r));
    port = server.address().port;
  });

  afterEach(async () => {
    await realtime.close();
    await new Promise((r) => server.close(r));
  });

  function connect(onMessage) {
    return new Promise((resolve, reject) => {
      const sock = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sock.on('open',    () => resolve(sock));
      sock.on('message', (data) => onMessage(JSON.parse(data.toString())));
      sock.on('error',   reject);
    });
  }

  it('sends a hello packet on connect', async () => {
    const messages = [];
    const sock = await connect((m) => messages.push(m));
    await new Promise((r) => setTimeout(r, 50));
    sock.close();
    expect(messages.find((m) => m.type === 'hello')).toBeTruthy();
  });

  it('broadcasts product:created when REST creates a product', async () => {
    const messages = [];
    const sock = await connect((m) => messages.push(m));
    await new Promise((r) => setTimeout(r, 30));

    await request(app)
      .post('/api/products')
      .send({ name: 'Broadcast Tee', price: 10, category: 'Tops', stock: 1, colors: ['X'], sizes: ['M'] });

    await new Promise((r) => setTimeout(r, 120));
    sock.close();

    const msg = messages.find((m) => m.type === 'product:created');
    expect(msg).toBeTruthy();
    expect(msg.data.name).toBe('Broadcast Tee');
  });

  it('broadcasts product:batch when generator ticks', async () => {
    const messages = [];
    const sock = await connect((m) => messages.push(m));
    await new Promise((r) => setTimeout(r, 30));

    await gen.tickOnce(2);
    await new Promise((r) => setTimeout(r, 120));
    sock.close();

    const batch = messages.find((m) => m.type === 'product:batch');
    expect(batch).toBeTruthy();
    expect(batch.data).toHaveLength(2);
  });

  it('broadcasts generator:state on start/stop', async () => {
    const messages = [];
    const sock = await connect((m) => messages.push(m));
    await new Promise((r) => setTimeout(r, 30));

    gen.start({ intervalMs: 5000, batchSize: 1 });
    gen.stop();
    await new Promise((r) => setTimeout(r, 60));
    sock.close();

    const states = messages.filter((m) => m.type === 'generator:state');
    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(states[0].data.running).toBe(true);
    expect(states[states.length - 1].data.running).toBe(false);
  });
});
