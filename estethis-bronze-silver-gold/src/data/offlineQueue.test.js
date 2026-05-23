// ─────────────────────────────────────────────────────────────
// OFFLINE QUEUE TESTS (Silver)
//
// Covers the localStorage persistence behaviour AND the op-coalescing
// rules that make replay efficient (and correct) when many edits
// happen offline against the same record.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compactOps, createOfflineQueue } from './offlineQueue.js';

// Provide a localStorage shim because vitest's default 'node' env
// doesn't have one — we just keep state in a plain Map.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

// ── compactOps — pure rules ──────────────────────────────────
describe('compactOps', () => {
  it('returns an empty list for an empty queue', () => {
    expect(compactOps([])).toEqual([]);
  });

  it('passes through a single op untouched', () => {
    const ops = [{ op: 'create', clientId: 'c1', payload: { name: 'X' } }];
    expect(compactOps(ops)).toEqual(ops);
  });

  it('collapses create + update into a single create with merged payload', () => {
    const ops = [
      { op: 'create', clientId: 'c1', payload: { name: 'A', price: 10 } },
      { op: 'update', id: 'c1',       payload: { name: 'A', price: 12 } },
    ];
    const compact = compactOps(ops);
    expect(compact).toHaveLength(1);
    expect(compact[0]).toMatchObject({ op: 'create', clientId: 'c1' });
    expect(compact[0].payload.price).toBe(12);
  });

  it('drops both ops when create + delete cancel out', () => {
    const ops = [
      { op: 'create', clientId: 'c1', payload: { name: 'A' } },
      { op: 'delete', id: 'c1' },
    ];
    expect(compactOps(ops)).toEqual([]);
  });

  it('keeps only the latest update when two updates target the same id', () => {
    const ops = [
      { op: 'update', id: 7, payload: { name: 'first' } },
      { op: 'update', id: 7, payload: { name: 'second' } },
    ];
    const compact = compactOps(ops);
    expect(compact).toHaveLength(1);
    expect(compact[0].payload.name).toBe('second');
  });

  it('replaces update with delete when both target the same server id', () => {
    const ops = [
      { op: 'update', id: 7, payload: { name: 'X' } },
      { op: 'delete', id: 7 },
    ];
    const compact = compactOps(ops);
    expect(compact).toHaveLength(1);
    expect(compact[0]).toEqual({ op: 'delete', id: 7 });
  });

  it('preserves operations on different records independently', () => {
    const ops = [
      { op: 'create', clientId: 'c1', payload: { name: 'A' } },
      { op: 'create', clientId: 'c2', payload: { name: 'B' } },
      { op: 'update', id: 5,          payload: { name: 'C' } },
      { op: 'delete', id: 6 },
    ];
    const compact = compactOps(ops);
    expect(compact).toHaveLength(4);
  });

  it('handles a four-step burst on the same record', () => {
    // create → update → update → delete on the SAME offline-only record
    const ops = [
      { op: 'create', clientId: 'c1', payload: { name: 'A', price: 10 } },
      { op: 'update', id: 'c1',       payload: { name: 'B', price: 20 } },
      { op: 'update', id: 'c1',       payload: { name: 'B', price: 30 } },
      { op: 'delete', id: 'c1' },
    ];
    expect(compactOps(ops)).toEqual([]); // nothing reaches the server
  });
});

// ── createOfflineQueue — behaviour ──────────────────────────
describe('createOfflineQueue', () => {
  it('starts empty when localStorage has no entry', () => {
    const q = createOfflineQueue();
    expect(q.size()).toBe(0);
    expect(q.snapshot()).toEqual([]);
  });

  it('persists across instances via localStorage', () => {
    const q1 = createOfflineQueue();
    q1.enqueue({ op: 'create', clientId: 'x', payload: { name: 'A' } });
    expect(q1.size()).toBe(1);

    const q2 = createOfflineQueue();
    expect(q2.size()).toBe(1);
    expect(q2.snapshot()[0].clientId).toBe('x');
  });

  it('notifies onChange listeners with the new size', () => {
    const q = createOfflineQueue();
    const sizes = [];
    q.onChange((s) => sizes.push(s));      // fires once with 0
    q.enqueue({ op: 'delete', id: 1 });
    q.enqueue({ op: 'delete', id: 2 });
    expect(sizes).toEqual([0, 1, 2]);
  });

  it('clear() empties the queue and persists the empty state', () => {
    const q = createOfflineQueue();
    q.enqueue({ op: 'delete', id: 1 });
    q.clear();
    expect(q.size()).toBe(0);
    const q2 = createOfflineQueue();
    expect(q2.size()).toBe(0);
  });

  it('flush() returns zero-result envelope when queue is empty', async () => {
    const q = createOfflineQueue({ syncFn: () => { throw new Error('should not be called'); } });
    const res = await q.flush();
    expect(res).toEqual({ results: [], applied: 0, failed: 0 });
  });

  it('flush() calls syncFn with compacted ops and clears the queue on success', async () => {
    const syncFn = vi.fn().mockResolvedValue({
      results: [{ ok: true, op: 'create' }],
      applied: 1, failed: 0,
    });
    const q = createOfflineQueue({ syncFn });

    q.enqueue({ op: 'create', clientId: 'c1', payload: { name: 'A', price: 1 } });
    q.enqueue({ op: 'update', id: 'c1',       payload: { name: 'A', price: 9 } });

    const res = await q.flush();

    expect(syncFn).toHaveBeenCalledOnce();
    const opsSent = syncFn.mock.calls[0][0];
    expect(opsSent).toHaveLength(1);            // compaction: create+update → 1 create
    expect(opsSent[0].payload.price).toBe(9);

    expect(res.applied).toBe(1);
    expect(q.size()).toBe(0);                   // cleared
  });

  it('flush() preserves the queue when the network call itself fails', async () => {
    const syncFn = vi.fn().mockRejectedValue(new Error('offline'));
    const q = createOfflineQueue({ syncFn });

    q.enqueue({ op: 'delete', id: 1 });
    q.enqueue({ op: 'delete', id: 2 });

    const res = await q.flush();
    expect(res).toBeNull();
    expect(q.size()).toBe(2);                   // intact for retry
  });
});
