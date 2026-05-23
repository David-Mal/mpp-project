// ─────────────────────────────────────────────────────────────
// SYNC CONTROLLER (Silver)
// Replays an offline op queue. Operations are applied sequentially
// (not concurrently) so an update can reliably follow its create.
// ─────────────────────────────────────────────────────────────

import repository    from './repository.js';
import { validateProduct } from './validator.js';
import { events, EVENTS }  from './events.js';

function runValidator(payload) {
  const fakeReq = { body: payload };
  let captured  = null;
  const fakeRes = {
    status(code) { captured = { code, body: null }; return fakeRes; },
    json(body)   { if (captured) captured.body = body; return fakeRes; },
  };
  let nextCalled = false;
  validateProduct(fakeReq, fakeRes, () => { nextCalled = true; });
  return nextCalled ? null : captured;
}

export async function syncController(req, res) {
  const ops     = Array.isArray(req.body?.operations) ? req.body.operations : [];
  const results = [];

  for (const op of ops) {
    try {
      switch (op.op) {
        case 'create': {
          const fail = runValidator(op.payload);
          if (fail) {
            results.push({ ok: false, op: op.op, clientId: op.clientId, status: fail.code, error: fail.body?.error });
            break;
          }
          const created = await repository.create(op.payload);
          events.emit(EVENTS.PRODUCT_CREATED, created);
          results.push({ ok: true, op: op.op, clientId: op.clientId, result: created });
          break;
        }

        case 'update': {
          const fail = runValidator(op.payload);
          if (fail) {
            results.push({ ok: false, op: op.op, id: op.id, status: fail.code, error: fail.body?.error });
            break;
          }
          const updated = await repository.update(op.id, op.payload);
          if (!updated) {
            results.push({ ok: false, op: op.op, id: op.id, status: 404, error: 'Not found.' });
            break;
          }
          events.emit(EVENTS.PRODUCT_UPDATED, updated);
          results.push({ ok: true, op: op.op, id: op.id, result: updated });
          break;
        }

        case 'delete': {
          const ok = await repository.delete(op.id);
          if (!ok) {
            results.push({ ok: false, op: op.op, id: op.id, status: 404, error: 'Not found.' });
            break;
          }
          events.emit(EVENTS.PRODUCT_DELETED, { id: parseInt(op.id, 10) });
          results.push({ ok: true, op: op.op, id: op.id });
          break;
        }

        default:
          results.push({ ok: false, op: op.op, error: `Unknown op '${op.op}'.` });
      }
    } catch (err) {
      results.push({ ok: false, op: op.op, id: op.id, error: err.message });
    }
  }

  res.json({
    results,
    applied: results.filter((r) => r.ok).length,
    failed:  results.filter((r) => !r.ok).length,
  });
}
