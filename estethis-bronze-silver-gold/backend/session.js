// ─────────────────────────────────────────────────────────────
// SESSION STORE — in-memory session management
//
// token → { payload, lastActivity, createdAt, authMethod }
//
// authMethod values:
//   'password'   — classic email + password login
//   'otp'        — phone/email + one-time code
//   'magic-link' — passwordless email magic link
//
// Inactivity timeout: configurable via SESSION_TIMEOUT_MS env var
// (default 30 minutes).  The client-side timer in App.jsx matches
// this value and triggers an automatic logout.
// ─────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';

const TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '') || 30 * 60 * 1000;

// token → { payload, lastActivity, createdAt, authMethod }
const sessions = new Map();

// Purge expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of sessions) {
    if (now - entry.lastActivity > TIMEOUT_MS) sessions.delete(token);
  }
}, 5 * 60 * 1000).unref();

/**
 * Create a new session.
 * @param {object} payload    – user info (id, email, role, permissions, …)
 * @param {string} authMethod – 'password' | 'otp' | 'magic-link'
 * @returns {string} session token (UUID)
 */
export function createSession(payload, authMethod = 'password') {
  const token = randomUUID();
  sessions.set(token, {
    payload,
    lastActivity: Date.now(),
    createdAt:    Date.now(),
    authMethod,
  });
  return token;
}

/**
 * Look up a session token.  Refreshes the inactivity timer on success.
 * Returns the payload (with authMethod injected) or null if expired/unknown.
 */
export function getSession(token) {
  const entry = sessions.get(token);
  if (!entry) return null;
  if (Date.now() - entry.lastActivity > TIMEOUT_MS) {
    sessions.delete(token);
    return null;
  }
  entry.lastActivity = Date.now();
  return { ...entry.payload, authMethod: entry.authMethod };
}

/** Immediately delete a session (logout). */
export function deleteSession(token) {
  sessions.delete(token);
}

/** Exposed for tests only. */
export function _getTimeoutMs()  { return TIMEOUT_MS;    }
export function _sessionCount()  { return sessions.size; }
