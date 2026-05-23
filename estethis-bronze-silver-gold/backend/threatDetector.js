// ─────────────────────────────────────────────────────────────
// THREAT DETECTOR (Step 4 — Gold)
//
// Evaluates three behavioural rules against the action log.
// Runs asynchronously after every persisted action so the
// observation list stays up-to-date in real-time.
//
// Rules
// ─────
// RULE 1 — HIGH_FREQUENCY
//   >= 20 actions by the same user within any 60-second window.
//   Signals: API flooding, bot behaviour, denial-of-service.
//
// RULE 2 — MASS_DELETION
//   >= 3 deletion actions (products / reviews / users) within 5 minutes.
//   Signals: malicious data destruction.
//
// RULE 3 — UNAUTHORIZED_ADMIN_PROBE
//   >= 3 admin-route actions recorded for a 'user' group account
//   (all-time, not windowed — every probe attempt is notable).
//   Signals: privilege-escalation attempts.
//
// On detection:
//   • If an active (unresolved) entry already exists for this
//     user + reason it is updated with fresh details.
//   • Otherwise a new entry is inserted.
// ─────────────────────────────────────────────────────────────

import { Op }                           from 'sequelize';
import { ActionLog, ObservationEntry, sequelize } from './models/index.js';

// Thresholds — kept as named constants for easy tuning / testing.
export const RULES = Object.freeze({
  HIGH_FREQUENCY: {
    label:  'High-Frequency Flooding',
    window: 60_000,   // ms
    count:  20,
  },
  MASS_DELETION: {
    label:  'Mass Deletion',
    window: 300_000,  // 5 min in ms
    count:  3,
  },
  UNAUTHORIZED_ADMIN_PROBE: {
    label:  'Unauthorized Admin Probe',
    window: null,     // all-time
    count:  3,
  },
});

// ── Individual rule evaluators ────────────────────────────────

async function checkHighFrequency(userId, now) {
  const since = new Date(now - RULES.HIGH_FREQUENCY.window);
  const n = await ActionLog.count({
    where: { userId, createdAt: { [Op.gte]: since } },
  });
  if (n < RULES.HIGH_FREQUENCY.count) return null;
  return { reason: 'HIGH_FREQUENCY', details: `${n} actions in the last 60 seconds` };
}

async function checkMassDeletion(userId, now) {
  const since = new Date(now - RULES.MASS_DELETION.window);
  const n = await ActionLog.count({
    where: {
      userId,
      createdAt:  { [Op.gte]: since },
      actionInfo: { [Op.like]: 'Deleted%' },
    },
  });
  if (n < RULES.MASS_DELETION.count) return null;
  return { reason: 'MASS_DELETION', details: `${n} destructive deletions in the last 5 minutes` };
}

async function checkAdminProbe(userId) {
  // Only meaningful for 'user'-group accounts — admins legitimately
  // access admin routes, so we pull the groupId from the log itself.
  const n = await ActionLog.count({
    where: {
      userId,
      groupId:    'user',
      actionInfo: { [Op.like]: 'Admin:%' },
    },
  });
  if (n < RULES.UNAUTHORIZED_ADMIN_PROBE.count) return null;
  return { reason: 'UNAUTHORIZED_ADMIN_PROBE', details: `${n} unauthorized admin endpoint attempts detected` };
}

// ── Upsert helper ─────────────────────────────────────────────

async function upsertThreat(userId, reason, details) {
  const existing = await ObservationEntry.findOne({
    where: { userId, reason, resolvedAt: null },
  });
  if (existing) {
    await existing.update({ details });
  } else {
    await ObservationEntry.create({ userId, reason, details });
  }
}

// ── Main entry point ──────────────────────────────────────────

export async function runThreatDetection(userId) {
  // Skip if the DB connection is closing (e.g., during test teardown).
  if (sequelize.connectionManager.pool?.ended) return;
  const now = Date.now();
  try {
    const checks = await Promise.all([
      checkHighFrequency(userId, now),
      checkMassDeletion(userId, now),
      checkAdminProbe(userId),
    ]);
    for (const threat of checks) {
      if (threat) await upsertThreat(userId, threat.reason, threat.details);
    }
  } catch {
    // Swallow — detection must never surface errors to the caller.
  }
}
