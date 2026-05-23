// ─────────────────────────────────────────────────────────────
// SESSION TESTS — token creation, expiry, inactivity timeout
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use a short timeout (5 s) for expiry tests so we can advance fake timers quickly.
const TIMEOUT_MS = 5_000;

let createSession, getSession, deleteSession;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubEnv('SESSION_TIMEOUT_MS', String(TIMEOUT_MS));
  vi.resetModules();
  // Fresh import after resetModules so the module re-runs with the stubbed env.
  ({ createSession, getSession, deleteSession } = await import('./session.js'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// ── Basic session lifecycle ───────────────────────────────────

describe('createSession / getSession', () => {
  it('createSession returns a non-empty string token', () => {
    const token = createSession({ id: 1, role: 'user' });
    expect(token).toBeTypeOf('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('getSession returns the stored payload', () => {
    const payload = { id: 42, email: 'test@x.com', role: 'admin' };
    const token = createSession(payload);
    expect(getSession(token)).toEqual(payload);
  });

  it('getSession returns null for unknown token', () => {
    expect(getSession('no-such-token')).toBeNull();
  });

  it('each createSession call returns a unique token', () => {
    const t1 = createSession({ id: 1 });
    const t2 = createSession({ id: 2 });
    expect(t1).not.toBe(t2);
  });
});

// ── deleteSession ─────────────────────────────────────────────

describe('deleteSession', () => {
  it('invalidates the session immediately', () => {
    const token = createSession({ id: 1 });
    deleteSession(token);
    expect(getSession(token)).toBeNull();
  });

  it('deleting a non-existent token does not throw', () => {
    expect(() => deleteSession('ghost-token')).not.toThrow();
  });

  it('other sessions are unaffected by a targeted delete', () => {
    const t1 = createSession({ id: 1 });
    const t2 = createSession({ id: 2 });
    deleteSession(t1);
    expect(getSession(t2)).not.toBeNull();
  });
});

// ── Inactivity expiry ─────────────────────────────────────────

describe('session inactivity expiry', () => {
  it('session is valid before the timeout elapses', () => {
    const token = createSession({ id: 1 });
    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    expect(getSession(token)).not.toBeNull();
  });

  it('session is null after the timeout elapses with no activity', () => {
    const token = createSession({ id: 1 });
    vi.advanceTimersByTime(TIMEOUT_MS + 1);
    expect(getSession(token)).toBeNull();
  });

  it('getSession activity resets the inactivity timer', () => {
    const token = createSession({ id: 1 });

    // Advance almost to the limit, then call getSession to reset the clock
    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    getSession(token); // activity — resets the timer

    // Advance another near-full window from the reset point
    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    expect(getSession(token)).not.toBeNull(); // still alive
  });

  it('session expires after two consecutive idle windows', () => {
    const token = createSession({ id: 1 });
    vi.advanceTimersByTime(TIMEOUT_MS + 1);
    expect(getSession(token)).toBeNull();
  });

  it('expired session returns null even on repeated calls', () => {
    const token = createSession({ id: 1 });
    vi.advanceTimersByTime(TIMEOUT_MS + 1);
    expect(getSession(token)).toBeNull();
    expect(getSession(token)).toBeNull(); // idempotent
  });
});

// ── Full session lifecycle ─────────────────────────────────────

describe('full session lifecycle', () => {
  it('create → get → payload matches', () => {
    const payload = { id: 7, email: 'u@u.com', role: 'user', permissions: ['products:read'] };
    const token = createSession(payload);
    const retrieved = getSession(token);
    expect(retrieved.email).toBe('u@u.com');
    expect(retrieved.permissions).toContain('products:read');
  });

  it('create → logout (delete) → get returns null', () => {
    const token = createSession({ id: 3, role: 'user' });
    deleteSession(token);
    expect(getSession(token)).toBeNull();
  });

  it('multiple sessions coexist independently', () => {
    const t1 = createSession({ id: 1 });
    const t2 = createSession({ id: 2 });
    const t3 = createSession({ id: 3 });
    deleteSession(t2);
    expect(getSession(t1)).not.toBeNull();
    expect(getSession(t2)).toBeNull();
    expect(getSession(t3)).not.toBeNull();
  });
});
