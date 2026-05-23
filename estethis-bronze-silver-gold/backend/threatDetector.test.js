// ─────────────────────────────────────────────────────────────
// THREAT DETECTOR TESTS (Step 4 — Gold)
// Tests each detection rule and the observation list endpoints.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Op } from 'sequelize';
import app from './app.js';
import { ActionLog, ObservationEntry, User } from './models/index.js';
import authSeed from './authSeed.js';
import { runThreatDetection, RULES } from './threatDetector.js';

const SEEDED_EMAILS = ['admin@estethis.com', 'user@estethis.com'];

beforeAll(async () => {
  await authSeed();
});

beforeEach(async () => {
  await ObservationEntry.destroy({ where: {} });
  await ActionLog.destroy({ where: {} });
  await User.destroy({ where: { email: { [Op.notIn]: SEEDED_EMAILS } } });
});

async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { token: res.body.token, user: res.body.user };
}

function seedLogs(userId, groupId, overrides = []) {
  return ActionLog.bulkCreate(overrides.map((o, i) => ({
    userId,
    groupId,
    actionInfo: o.actionInfo ?? 'Listed products',
    createdAt:  o.createdAt  ?? new Date(Date.now() - i * 100),
  })));
}

// ── Rule 1: High-Frequency ────────────────────────────────────

describe('RULE: HIGH_FREQUENCY', () => {
  it('flags a user who generates >= 20 actions in 60 seconds', async () => {
    const { user } = await loginAs('user@estethis.com', 'user123');
    await ActionLog.destroy({ where: {} });

    await seedLogs(user.id, 'user', Array(RULES.HIGH_FREQUENCY.count).fill({}));
    await runThreatDetection(user.id);

    const entry = await ObservationEntry.findOne({
      where: { userId: user.id, reason: 'HIGH_FREQUENCY' },
    });
    expect(entry).toBeTruthy();
    expect(entry.resolvedAt).toBeNull();
    expect(entry.details).toMatch(/\d+ actions in the last 60 seconds/);
  });

  it('does NOT flag a user below the threshold', async () => {
    const { user } = await loginAs('user@estethis.com', 'user123');
    await ActionLog.destroy({ where: {} });

    await seedLogs(user.id, 'user', Array(RULES.HIGH_FREQUENCY.count - 1).fill({}));
    await runThreatDetection(user.id);

    const entry = await ObservationEntry.findOne({
      where: { userId: user.id, reason: 'HIGH_FREQUENCY' },
    });
    expect(entry).toBeNull();
  });

  it('does NOT count actions outside the 60-second window', async () => {
    const { user } = await loginAs('user@estethis.com', 'user123');
    await ActionLog.destroy({ where: {} });

    // 10 recent + 10 old (older than 60s)
    const recent = Array(10).fill({ createdAt: new Date() });
    const old    = Array(10).fill({ createdAt: new Date(Date.now() - 120_000) });
    await seedLogs(user.id, 'user', [...recent, ...old]);
    await runThreatDetection(user.id);

    const entry = await ObservationEntry.findOne({
      where: { userId: user.id, reason: 'HIGH_FREQUENCY' },
    });
    expect(entry).toBeNull();
  });
});

// ── Rule 2: Mass Deletion ─────────────────────────────────────

describe('RULE: MASS_DELETION', () => {
  it('flags a user who deletes >= 3 items within 5 minutes', async () => {
    const { user } = await loginAs('admin@estethis.com', 'admin123');
    await ActionLog.destroy({ where: {} });

    await seedLogs(user.id, 'admin', [
      { actionInfo: 'Deleted product #1' },
      { actionInfo: 'Deleted product #2' },
      { actionInfo: 'Deleted product #3' },
    ]);
    await runThreatDetection(user.id);

    const entry = await ObservationEntry.findOne({
      where: { userId: user.id, reason: 'MASS_DELETION' },
    });
    expect(entry).toBeTruthy();
    expect(entry.details).toMatch(/3 destructive deletions/);
  });

  it('does NOT flag deletions spread across more than 5 minutes', async () => {
    const { user } = await loginAs('admin@estethis.com', 'admin123');
    await ActionLog.destroy({ where: {} });

    await seedLogs(user.id, 'admin', [
      { actionInfo: 'Deleted product #1', createdAt: new Date() },
      { actionInfo: 'Deleted product #2', createdAt: new Date() },
      { actionInfo: 'Deleted product #3', createdAt: new Date(Date.now() - 400_000) },
    ]);
    await runThreatDetection(user.id);

    const entry = await ObservationEntry.findOne({
      where: { userId: user.id, reason: 'MASS_DELETION' },
    });
    expect(entry).toBeNull();
  });
});

// ── Rule 3: Unauthorized Admin Probe ─────────────────────────

describe('RULE: UNAUTHORIZED_ADMIN_PROBE', () => {
  it('flags a user-role account that repeatedly probes admin routes', async () => {
    const { user } = await loginAs('user@estethis.com', 'user123');
    await ActionLog.destroy({ where: {} });

    await seedLogs(user.id, 'user', [
      { actionInfo: 'Admin: viewed action logs' },
      { actionInfo: 'Admin: viewed observation list' },
      { actionInfo: 'Admin: listed all users' },
    ]);
    await runThreatDetection(user.id);

    const entry = await ObservationEntry.findOne({
      where: { userId: user.id, reason: 'UNAUTHORIZED_ADMIN_PROBE' },
    });
    expect(entry).toBeTruthy();
    expect(entry.details).toMatch(/unauthorized admin endpoint/i);
  });

  it('does NOT flag admin users accessing admin routes', async () => {
    const { user } = await loginAs('admin@estethis.com', 'admin123');
    await ActionLog.destroy({ where: {} });

    // groupId = 'admin' — not a probe
    await seedLogs(user.id, 'admin', [
      { actionInfo: 'Admin: viewed action logs' },
      { actionInfo: 'Admin: viewed observation list' },
      { actionInfo: 'Admin: listed all users' },
    ]);
    await runThreatDetection(user.id);

    const entry = await ObservationEntry.findOne({
      where: { userId: user.id, reason: 'UNAUTHORIZED_ADMIN_PROBE' },
    });
    expect(entry).toBeNull();
  });
});

// ── Upsert behaviour ─────────────────────────────────────────

describe('Observation entry upsert', () => {
  it('updates details on repeated detection instead of creating duplicates', async () => {
    const { user } = await loginAs('user@estethis.com', 'user123');
    await ActionLog.destroy({ where: {} });

    await seedLogs(user.id, 'user', Array(RULES.HIGH_FREQUENCY.count).fill({}));
    await runThreatDetection(user.id);
    await runThreatDetection(user.id); // run again

    const count = await ObservationEntry.count({
      where: { userId: user.id, reason: 'HIGH_FREQUENCY' },
    });
    expect(count).toBe(1); // still just one entry
  });

  it('creates a new entry after admin resolves the previous one', async () => {
    const { user } = await loginAs('user@estethis.com', 'user123');
    await ActionLog.destroy({ where: {} });

    await seedLogs(user.id, 'user', Array(RULES.HIGH_FREQUENCY.count).fill({}));
    await runThreatDetection(user.id);

    const first = await ObservationEntry.findOne({
      where: { userId: user.id, reason: 'HIGH_FREQUENCY' },
    });
    await first.update({ resolvedAt: new Date() });

    // Trigger again — should produce a NEW entry
    await runThreatDetection(user.id);

    const all = await ObservationEntry.findAll({
      where: { userId: user.id, reason: 'HIGH_FREQUENCY' },
    });
    expect(all).toHaveLength(2);
    const active = all.find(e => !e.resolvedAt);
    expect(active).toBeTruthy();
  });
});

// ── Observation List API ──────────────────────────────────────

describe('GET /api/admin/observation', () => {
  it('admin sees all active threats', async () => {
    const { user: normalUser } = await loginAs('user@estethis.com', 'user123');
    const { token: adminToken } = await loginAs('admin@estethis.com', 'admin123');
    await ActionLog.destroy({ where: {} });

    // Trigger UNAUTHORIZED_ADMIN_PROBE for the regular user
    await seedLogs(normalUser.id, 'user', [
      { actionInfo: 'Admin: viewed action logs' },
      { actionInfo: 'Admin: viewed observation list' },
      { actionInfo: 'Admin: listed all users' },
    ]);
    await runThreatDetection(normalUser.id);

    const res = await request(app)
      .get('/api/admin/observation')
      .set('X-Session-Token', adminToken);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const entry = res.body.find(e => e.userId === normalUser.id);
    expect(entry).toBeTruthy();
    expect(entry.reason).toBe('UNAUTHORIZED_ADMIN_PROBE');
    expect(entry.userEmail).toBe('user@estethis.com');
    expect(entry.resolvedAt).toBeNull();
  });

  it('regular user cannot access the observation list (403)', async () => {
    const { token } = await loginAs('user@estethis.com', 'user123');
    const res = await request(app)
      .get('/api/admin/observation')
      .set('X-Session-Token', token);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/observation/:id', () => {
  it('admin can resolve an active observation entry', async () => {
    const { user: normalUser } = await loginAs('user@estethis.com', 'user123');
    const { token: adminToken } = await loginAs('admin@estethis.com', 'admin123');
    await ActionLog.destroy({ where: {} });

    await seedLogs(normalUser.id, 'user', Array(RULES.HIGH_FREQUENCY.count).fill({}));
    await runThreatDetection(normalUser.id);

    const entry = await ObservationEntry.findOne({ where: { userId: normalUser.id } });
    expect(entry).toBeTruthy();

    const res = await request(app)
      .delete(`/api/admin/observation/${entry.id}`)
      .set('X-Session-Token', adminToken);
    expect(res.status).toBe(204);

    await entry.reload();
    expect(entry.resolvedAt).not.toBeNull();
  });

  it('returns 404 for a non-existent entry', async () => {
    const { token } = await loginAs('admin@estethis.com', 'admin123');
    const res = await request(app)
      .delete('/api/admin/observation/99999')
      .set('X-Session-Token', token);
    expect(res.status).toBe(404);
  });
});
