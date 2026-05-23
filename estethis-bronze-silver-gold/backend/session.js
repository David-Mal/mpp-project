import { randomUUID } from 'node:crypto';

// Inactivity timeout: 30 minutes (configurable via SESSION_TIMEOUT_MS env var)
const TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '') || 30 * 60 * 1000;

// token → { payload, lastActivity }
const sessions = new Map();

// Purge expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of sessions) {
    if (now - entry.lastActivity > TIMEOUT_MS) sessions.delete(token);
  }
}, 5 * 60 * 1000).unref();

export function createSession(payload) {
  const token = randomUUID();
  sessions.set(token, { payload, lastActivity: Date.now() });
  return token;
}

export function getSession(token) {
  const entry = sessions.get(token);
  if (!entry) return null;
  if (Date.now() - entry.lastActivity > TIMEOUT_MS) {
    sessions.delete(token);
    return null;
  }
  entry.lastActivity = Date.now(); // refresh on activity
  return entry.payload;
}

export function deleteSession(token) {
  sessions.delete(token);
}

/** Exposed for tests only. */
export function _getTimeoutMs() { return TIMEOUT_MS; }
export function _sessionCount() { return sessions.size; }
