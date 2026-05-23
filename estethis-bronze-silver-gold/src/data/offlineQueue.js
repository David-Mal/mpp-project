// ─────────────────────────────────────────────────────────────
// OFFLINE QUEUE — localStorage-backed CRUD log (Silver)
//
// While offline (browser network down OR server unreachable), CRUD
// mutations are applied to a local in-memory mirror immediately AND
// queued here. When connectivity returns, the queue is replayed
// against /api/products/sync, which returns per-op outcomes so the
// caller can reconcile (toast errors for ops that the server
// rejected, e.g. updates against products another browser deleted).
//
// The queue is mirrored to localStorage so it survives page reloads
// while disconnected.
//
// Op shape:
//   { op: 'create', clientId, payload }
//   { op: 'update', id, payload }
//   { op: 'delete', id }
//
// `clientId` is a UUID generated on the client at create time. The
// server assigns its own numeric `id` once the op is replayed; we
// then map clientId → server id so subsequent UI refs (a follow-up
// edit while still offline, for example) can be resolved.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'estethis-offline-queue';

function loadFromStorage() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveToStorage(queue) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  } catch { /* quota / private mode — non-fatal */ }
}

/**
 * Coalesce ops on the same record so we don't replay redundant work.
 *
 *   create + update   → create with merged payload
 *   create + delete   → drop both (record never existed on server)
 *   update + update   → latest payload wins
 *   update + delete   → delete only
 *   any  + new create → kept as-is (different record)
 *
 * Exported so the test suite can assert the rules directly without
 * spinning up the whole queue.
 */
export function compactOps(queue) {
  /** Map<key, op>. key = clientId for offline-only creates, server id otherwise. */
  const byKey = new Map();
  /** order of first-introduction so we replay in roughly the original order */
  const order = [];

  for (const op of queue) {
    // Key determination: if this is a create, key by clientId.
    // Otherwise, check if the id looks like a clientId (string, not a number)
    // and use that as the key; if it's a number, treat it as a server id.
    let key;
    if (op.op === 'create') {
      key = `c:${op.clientId}`;
    } else {
      // id could be a number (server id) or string (clientId from an offline create)
      const isOfflineId = typeof op.id === 'string' && isNaN(Number(op.id));
      key = isOfflineId ? `c:${op.id}` : `s:${op.id}`;
    }

    if (op.op === 'create') {
      byKey.set(key, { ...op });
      if (!order.includes(key)) order.push(key);
    } else if (op.op === 'update') {
      const prev = byKey.get(key);
      if (prev?.op === 'create') {
        // Merge into the existing create.
        byKey.set(key, { op: 'create', clientId: prev.clientId, payload: { ...prev.payload, ...op.payload } });
      } else {
        byKey.set(key, { op: 'update', id: op.id, payload: op.payload });
      }
      if (!order.includes(key)) order.push(key);
    } else if (op.op === 'delete') {
      const prev = byKey.get(key);
      if (prev?.op === 'create') {
        // Cancel out — record never hit the server.
        byKey.delete(key);
        const idx = order.indexOf(key);
        if (idx >= 0) order.splice(idx, 1);
      } else {
        byKey.set(key, { op: 'delete', id: op.id });
        if (!order.includes(key)) order.push(key);
      }
    }
  }

  return order.map((k) => byKey.get(k)).filter(Boolean);
}

/**
 * @param {{ syncFn?: (ops) => Promise<{results, applied, failed}> }} [options]
 *        syncFn lets tests inject a mock instead of going to network.
 */
export function createOfflineQueue({ syncFn } = {}) {
  let queue = loadFromStorage();
  /** Set<(size:number)=>void> */
  const listeners = new Set();
  const notify = () => { for (const fn of listeners) fn(queue.length); };

  function enqueue(op) {
    queue = [...queue, op];
    saveToStorage(queue);
    notify();
  }

  /**
   * Replay the queue. Returns the server response on success, or
   * `null` if the network call itself failed (in which case the
   * queue is preserved for the next attempt).
   */
  async function flush() {
    if (queue.length === 0) return { results: [], applied: 0, failed: 0 };

    const ops = compactOps(queue);
    let response;
    try {
      response = syncFn ? await syncFn(ops) : null;
      if (!syncFn) {
        const { apiSync } = await import('./api.js');
        response = await apiSync(ops);
      }
    } catch {
      return null; // keep queue for next try
    }

    queue = [];
    saveToStorage(queue);
    notify();
    return response;
  }

  function clear() { queue = []; saveToStorage(queue); notify(); }
  function size()  { return queue.length; }
  function snapshot() { return [...queue]; }

  function onChange(listener) {
    listeners.add(listener);
    listener(queue.length);
    return () => listeners.delete(listener);
  }

  return { enqueue, flush, clear, size, snapshot, onChange };
}
