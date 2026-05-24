// ─────────────────────────────────────────────────────────────
// TOKEN STORE — in-memory store for short-lived auth tokens
//
// Manages three independent namespaces:
//   OTP          6-digit numeric code, valid 10 min, single-use
//                keyed by email or phone number
//   Magic link   UUID token, valid 15 min, single-use
//                keyed by token → email
//   Reset token  UUID token, valid 30 min, single-use
//                keyed by token → userId
//
// In production these would be persisted in Redis / DB and
// distributed via SMS gateway / email service.  For the lab
// demo the generated values are echoed back in the API response
// so they can be used without a real mail/SMS server.
// ─────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';

const OTP_TTL_MS   = 10 * 60 * 1000; // 10 minutes
const MAGIC_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Internal stores
const _otp   = new Map(); // identifier → { code, expiresAt }
const _magic = new Map(); // token      → { email, expiresAt }
const _reset = new Map(); // token      → { userId, expiresAt }

function isExpired(expiresAt) { return Date.now() > expiresAt; }

// ── Periodic cleanup ──────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _otp)   { if (now > v.expiresAt) _otp.delete(k);   }
  for (const [k, v] of _magic) { if (now > v.expiresAt) _magic.delete(k); }
  for (const [k, v] of _reset) { if (now > v.expiresAt) _reset.delete(k); }
}, 5 * 60 * 1000).unref();

// ── OTP ───────────────────────────────────────────────────────

/** Generate and store a 6-digit OTP for the given identifier (email or phone). */
export function createOtp(identifier) {
  const code      = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + OTP_TTL_MS;
  _otp.set(identifier, { code, expiresAt });
  return code;
}

/**
 * Verify an OTP.  Returns true and deletes the entry on success.
 * Returns false if the code is wrong, expired, or unknown.
 */
export function verifyOtp(identifier, code) {
  const entry = _otp.get(identifier);
  if (!entry)                  return false;
  if (isExpired(entry.expiresAt)) { _otp.delete(identifier); return false; }
  if (entry.code !== String(code)) return false;
  _otp.delete(identifier); // single-use
  return true;
}

// ── Magic link ────────────────────────────────────────────────

/** Generate and store a magic-link token for the given email. */
export function createMagicToken(email) {
  const token     = randomUUID();
  const expiresAt = Date.now() + MAGIC_TTL_MS;
  _magic.set(token, { email, expiresAt });
  return token;
}

/**
 * Verify a magic-link token.  Returns the email on success (and deletes
 * the entry — single-use).  Returns null if invalid or expired.
 */
export function verifyMagicToken(token) {
  const entry = _magic.get(token);
  if (!entry)                   return null;
  if (isExpired(entry.expiresAt)) { _magic.delete(token); return null; }
  _magic.delete(token); // single-use
  return entry.email;
}

// ── Password reset ────────────────────────────────────────────

/** Generate and store a password-reset token for the given userId. */
export function createResetToken(userId) {
  const token     = randomUUID();
  const expiresAt = Date.now() + RESET_TTL_MS;
  _reset.set(token, { userId, expiresAt });
  return token;
}

/**
 * Peek at a reset token without consuming it.
 * Returns userId on success, null if invalid or expired.
 */
export function peekResetToken(token) {
  const entry = _reset.get(token);
  if (!entry)                   return null;
  if (isExpired(entry.expiresAt)) { _reset.delete(token); return null; }
  return entry.userId;
}

/** Consume (delete) a reset token after the password has been changed. */
export function consumeResetToken(token) {
  _reset.delete(token);
}

// ── Test helpers ──────────────────────────────────────────────
export function _clearAll() {
  _otp.clear(); _magic.clear(); _reset.clear();
}
export function _otpCount()   { return _otp.size;   }
export function _magicCount() { return _magic.size; }
export function _resetCount() { return _reset.size; }
