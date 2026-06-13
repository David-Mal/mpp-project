// ─────────────────────────────────────────────────────────────
// STORAGE.JS  — Persistence layer (Phase 5)
//
// Two independent systems:
//
//  1. localStorage  — long-term, survives browser restart.
//     User-scoped keys  → `estethis_<key>_u<userId>`
//     Global keys       → `estethis_<key>`
//
//  2. Cookies  — activity monitoring / personalisation.
//     Written with SameSite=Lax, 30-day expiry by default.
//     Cookie names are prefixed with `est_`.
//
// Nothing in here talks to the network.
// ─────────────────────────────────────────────────────────────

const APP = 'estethis';
const COOKIE_PFX = 'est_';

// ══════════════════════════════════════════════════
// localStorage helpers
// ══════════════════════════════════════════════════

/** Build a user-scoped key: estethis_<key>_u<userId> */
function userKey(userId, key) {
  return `${APP}_${key}_u${userId}`;
}

/** Build a global (non-user) key: estethis_<key> */
function globalKey(key) {
  return `${APP}_${key}`;
}

/**
 * Save a value under a user-scoped localStorage key.
 * Silently ignores QuotaExceededError and JSON errors.
 */
export function saveUserData(userId, key, value) {
  if (!userId) return;
  try {
    localStorage.setItem(userKey(userId, key), JSON.stringify(value));
  } catch { /* storage full or private-browsing restrictions */ }
}

/**
 * Load a value from a user-scoped localStorage key.
 * Returns `fallback` when the key is absent or un-parseable.
 */
export function loadUserData(userId, key, fallback = null) {
  if (!userId) return fallback;
  try {
    const raw = localStorage.getItem(userKey(userId, key));
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

/** Delete a user-scoped localStorage key. */
export function removeUserData(userId, key) {
  if (!userId) return;
  try { localStorage.removeItem(userKey(userId, key)); } catch {}
}

/** Save a value under a global (non-user-scoped) key. */
export function saveGlobal(key, value) {
  try {
    localStorage.setItem(globalKey(key), JSON.stringify(value));
  } catch {}
}

/** Load a value from a global key. */
export function loadGlobal(key, fallback = null) {
  try {
    const raw = localStorage.getItem(globalKey(key));
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

/** Remove a global key. */
export function removeGlobal(key) {
  try { localStorage.removeItem(globalKey(key)); } catch {}
}

// ══════════════════════════════════════════════════
// Cookie helpers
// ══════════════════════════════════════════════════

/**
 * Write a cookie.
 * @param {string} name   – unprefixed name (prefix `est_` is added automatically)
 * @param {string} value  – will be URI-encoded
 * @param {number} days   – expiry in days (default 30)
 */
export function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
  document.cookie =
    `${COOKIE_PFX}${name}=${encodeURIComponent(value)}; ` +
    `expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Read a cookie by unprefixed name.
 * Returns null when the cookie is absent.
 */
export function getCookie(name) {
  const target = `${COOKIE_PFX}${name}=`;
  const pair   = document.cookie.split('; ').find(c => c.startsWith(target));
  return pair ? decodeURIComponent(pair.slice(target.length)) : null;
}

/** Delete a cookie by unprefixed name. */
export function removeCookie(name) {
  document.cookie =
    `${COOKIE_PFX}${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// ══════════════════════════════════════════════════
// Activity tracking  (cookie-based personalisation)
// ══════════════════════════════════════════════════

/**
 * Record the current SPA view name in a cookie.
 * Stored as `est_last_page`.
 */
export function trackPageVisit(viewName) {
  if (!viewName) return;
  setCookie('last_page', viewName, 30);
}

/**
 * Add a product category to the "recently viewed categories" cookie.
 * Keeps up to 5 unique categories, most-recent-first.
 * Stored as `est_recent_cats`.
 */
export function trackCategoryView(category) {
  if (!category) return;
  const existing = getCookie('recent_cats') || '';
  const cats = existing
    ? existing.split(',').filter(c => c && c !== category)
    : [];
  cats.unshift(category);
  setCookie('recent_cats', cats.slice(0, 5).join(','), 30);
}

/**
 * Return the array of recently viewed categories (most-recent-first).
 * Returns [] when the cookie is absent.
 */
export function getRecentCategories() {
  const val = getCookie('recent_cats');
  return val ? val.split(',').filter(Boolean) : [];
}

/** Return the last SPA view name visited, or null. */
export function getLastPage() {
  return getCookie('last_page');
}

/**
 * Clear all activity cookies (e.g. on logout).
 */
export function clearActivityCookies() {
  removeCookie('last_page');
  removeCookie('recent_cats');
}
