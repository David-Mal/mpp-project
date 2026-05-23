// ─────────────────────────────────────────────────────────────
// API.JS — Frontend service layer for the Express backend
//
// Bronze: thin fetch wrapper, throws on non-2xx.
// Silver addition: ApiError class so the rest of the app can tell
// the difference between a network failure (status === 0 → swap to
// offline mode) and a validation failure (status === 400 → show the
// error to the user, do NOT queue).
//
// All network calls go through here so we have one place to add
// the offline detection.
//
// The Vite dev-server proxy forwards /api/* → http://localhost:3001
// so we use a relative base URL (works in both dev & production build).
// ─────────────────────────────────────────────────────────────

const BASE      = '/api/products';
const AUTH_BASE = '/api/auth';

// ── Session token (stored in localStorage) ────────────────────
const TOKEN_KEY = 'estethis_token';
export const getStoredToken  = () => localStorage.getItem(TOKEN_KEY);
export const setStoredToken  = (t) => t
  ? localStorage.setItem(TOKEN_KEY, t)
  : localStorage.removeItem(TOKEN_KEY);

// Custom error class — every failure mode gets a status code and
// the original `error` string from the server (when available).
export class ApiError extends Error {
  constructor(message, { status = 0, payload = null } = {}) {
    super(message);
    this.status  = status;
    this.payload = payload;
  }
  /** True for network/CORS/server-down failures (status 0). */
  get isNetwork()    { return this.status === 0; }
  /** True for server-side validation failures (status 400). */
  get isValidation() { return this.status === 400; }
}

/** Generic fetch wrapper — attaches session token when present. */
async function apiFetch(url, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Session-Token': token } : {}),
    ...(options.headers ?? {}),
  };
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    // fetch() rejects only on network-level failures (DNS, refused,
    // CORS, offline). HTTP errors come back as a normal Response.
    throw new ApiError(`Network error: ${err.message}`, { status: 0 });
  }

  if (res.status === 204) return null;   // DELETE success — no body

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Server error ${res.status}`,
      { status: res.status, payload: data },
    );
  }
  return data;
}

// ── READ ─────────────────────────────────────────────────────

/**
 * Fetch all products (uses a large limit so the whole catalogue arrives).
 * The frontend does its own client-side pagination on top.
 */
export async function fetchAllProducts() {
  const result = await apiFetch(`${BASE}?page=1&limit=1000`);
  return result.data;
}

/**
 * Fetch a page with optional server-side search and sort.
 * Used by the infinite-scroll hook.
 */
export async function fetchProductsFiltered({ page = 1, limit = 8, search = '', sort = '' } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (search) params.set('search', search);
  if (sort)   params.set('sort',   sort);
  return apiFetch(`${BASE}?${params}`);
}

/** Fetch aggregate statistics. */
export async function fetchStats() {
  return apiFetch(`${BASE}/stats`);
}

// ── WRITE ────────────────────────────────────────────────────

export async function apiCreateProduct(data) {
  return apiFetch(BASE, { method: 'POST', body: JSON.stringify(data) });
}

export async function apiUpdateProduct(id, data) {
  return apiFetch(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function apiDeleteProduct(id) {
  return apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}

// ── SILVER ───────────────────────────────────────────────────

/** Replays a queued list of operations against the server. */
export async function apiSync(operations) {
  return apiFetch(`${BASE}/sync`, {
    method: 'POST',
    body:   JSON.stringify({ operations }),
  });
}

/** Generator (Faker loop) control surface. */
export const generatorApi = {
  status: ()           => apiFetch(`${BASE}/generator`),
  start:  (opts = {})  => apiFetch(`${BASE}/generator/start`, { method: 'POST', body: JSON.stringify(opts) }),
  stop:   ()           => apiFetch(`${BASE}/generator/stop`,  { method: 'POST' }),
  tick:   (opts = {})  => apiFetch(`${BASE}/generator/tick`,  { method: 'POST', body: JSON.stringify(opts) }),
};

/** Quick liveness probe used by the connection detector. */
export async function apiHealth() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch { return false; }
}

// ── AUTH ─────────────────────────────────────────────────────

/** Login and store the session token. Returns { token, user }. */
export async function apiLogin(email, password) {
  const data = await apiFetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setStoredToken(data.token);
  return data;
}

/** Register and store the session token. Returns { token, user }. */
export async function apiRegister(email, phone, password) {
  const data = await apiFetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    body: JSON.stringify({ email, phone, password }),
  });
  setStoredToken(data.token);
  return data;
}

/** Logout — clears server session and local token. */
export async function apiLogout() {
  try { await apiFetch(`${AUTH_BASE}/logout`, { method: 'POST' }); } catch { /* ok */ }
  setStoredToken(null);
}

/** Validate stored token and return current user, or null. */
export async function apiMe() {
  try { return await apiFetch(`${AUTH_BASE}/me`); } catch { return null; }
}

/** Admin: list all users. */
export async function apiListUsers() {
  return apiFetch(`${AUTH_BASE}/users`);
}

/** Admin: delete a user by id. */
export async function apiDeleteUser(id) {
  return apiFetch(`${AUTH_BASE}/users/${id}`, { method: 'DELETE' });
}

// ── ADMIN — Observation List (Step 4) ────────────────────────

const ADMIN_BASE = '/api/admin';

/** Admin: fetch the observation list. Pass showResolved=true to include resolved entries. */
export async function apiObservationList(showResolved = false) {
  return apiFetch(`${ADMIN_BASE}/observation?resolved=${showResolved}`);
}

/** Admin: resolve (clear) an observation entry. */
export async function apiResolveObservation(id) {
  return apiFetch(`${ADMIN_BASE}/observation/${id}`, { method: 'DELETE' });
}

/** Admin: fetch action logs with optional filters. */
export async function apiActionLogs({ page = 1, limit = 50, userId, groupId, search } = {}) {
  const p = new URLSearchParams({ page, limit });
  if (userId)  p.set('userId',  userId);
  if (groupId) p.set('groupId', groupId);
  if (search)  p.set('search',  search);
  return apiFetch(`${ADMIN_BASE}/logs?${p}`);
}
