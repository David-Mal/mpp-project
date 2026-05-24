// ─────────────────────────────────────────────────────────────
// RATE LIMITER — brute-force protection for auth endpoints
//
// Tracks per-IP attempt counts within a fixed time window.
// Factory pattern so tests can create isolated instances.
// ─────────────────────────────────────────────────────────────

const WINDOW_MS_DEFAULT   = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_DEFAULT = 10;

/**
 * Create an in-memory rate-limiting middleware.
 * @param {object} opts
 * @param {number} opts.windowMs   – Time window in ms (default 15 min)
 * @param {number} opts.max        – Max attempts per IP per window (default 10)
 */
export function createRateLimiter({ windowMs = WINDOW_MS_DEFAULT, max = MAX_ATTEMPTS_DEFAULT } = {}) {
  const store = new Map(); // ip → { count, windowStart }

  function prune(now) {
    for (const [key, entry] of store) {
      if (now - entry.windowStart > windowMs) store.delete(key);
    }
  }

  function middleware(req, res, next) {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    prune(now);

    const entry = store.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
      store.set(ip, { count: 1, windowStart: now });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      const retryAfterSec = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  }

  // Exposed so tests can inspect and reset state without reloading the module
  middleware._store   = store;
  middleware._reset   = () => store.clear();
  middleware._windowMs = windowMs;
  middleware._max      = max;
  return middleware;
}

// Default instance used in the production Express app
export const authLimiter = createRateLimiter();
