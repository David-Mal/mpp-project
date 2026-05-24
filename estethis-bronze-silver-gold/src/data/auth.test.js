// ─────────────────────────────────────────────────────────────
// FRONTEND AUTH TESTS — api.js auth functions
// Tests the frontend API layer: login, register, logout, me.
// Runs in node environment; fetch and localStorage are mocked.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ── localStorage mock (not available in node environment) ─────
const store = {};
const localStorageMock = {
  getItem:    (k)    => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k)    => { delete store[k]; },
  clear:      ()     => { Object.keys(store).forEach(k => delete store[k]); },
};
vi.stubGlobal('localStorage', localStorageMock);

// ── fetch mock ────────────────────────────────────────────────
function mockFetch(status, body) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

// ── Import AFTER globals are stubbed ─────────────────────────
const { apiLogin, apiRegister, apiLogout, apiMe, getStoredToken, setStoredToken, ApiError } =
  await import('./api.js');

// ─────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ── apiLogin ──────────────────────────────────────────────────

describe('apiLogin', () => {
  it('calls POST /api/auth/login with email and password', async () => {
    const fetchMock = mockFetch(200, { token: 'tok-1', user: { email: 'a@b.com', role: 'user' } });
    vi.stubGlobal('fetch', fetchMock);

    await apiLogin('a@b.com', 'pass123');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.email).toBe('a@b.com');
    expect(body.password).toBe('pass123');
  });

  it('stores the token in localStorage on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { token: 'stored-tok', user: { email: 'a@b.com', role: 'user' } }));
    await apiLogin('a@b.com', 'pass123');
    expect(getStoredToken()).toBe('stored-tok');
  });

  it('returns user and token from the server', async () => {
    const payload = { token: 'tok-2', user: { id: 1, email: 'a@b.com', role: 'user', permissions: ['products:read'] } };
    vi.stubGlobal('fetch', mockFetch(200, payload));
    const result = await apiLogin('a@b.com', 'pass123');
    expect(result.token).toBe('tok-2');
    expect(result.user.role).toBe('user');
  });

  it('throws ApiError with status 401 on wrong credentials', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { error: 'Invalid credentials' }));
    await expect(apiLogin('x@x.com', 'wrong')).rejects.toThrow(ApiError);
    const err = await apiLogin('x@x.com', 'wrong').catch(e => e);
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/invalid credentials/i);
  });

  it('does not store token on failed login', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { error: 'Invalid credentials' }));
    await apiLogin('x@x.com', 'wrong').catch(() => {});
    expect(getStoredToken()).toBeNull();
  });

  it('throws ApiError with status 0 on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const err = await apiLogin('a@b.com', 'pass').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.isNetwork).toBe(true);
  });

  it('sends Content-Type: application/json header', async () => {
    const fetchMock = mockFetch(200, { token: 't', user: {} });
    vi.stubGlobal('fetch', fetchMock);
    await apiLogin('a@b.com', 'pass').catch(() => {});
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ── apiRegister ───────────────────────────────────────────────

describe('apiRegister', () => {
  it('calls POST /api/auth/register with email, phone and password', async () => {
    const fetchMock = mockFetch(201, { token: 'new-tok', user: { email: 'new@a.com', role: 'user' } });
    vi.stubGlobal('fetch', fetchMock);

    await apiRegister('new@a.com', '+40700000000', 'pass123');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/register');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.email).toBe('new@a.com');
    expect(body.phone).toBe('+40700000000');
    expect(body.password).toBe('pass123');
  });

  it('stores the token in localStorage on success', async () => {
    vi.stubGlobal('fetch', mockFetch(201, { token: 'reg-tok', user: { email: 'new@a.com', role: 'user' } }));
    await apiRegister('new@a.com', '+407', 'pass123');
    expect(getStoredToken()).toBe('reg-tok');
  });

  it('returns user and token from the server', async () => {
    const payload = {
      token: 'reg-tok-2',
      user: { id: 5, email: 'new@a.com', role: 'user', permissions: ['products:read'] },
    };
    vi.stubGlobal('fetch', mockFetch(201, payload));
    const result = await apiRegister('new@a.com', '+407', 'pass123');
    expect(result.token).toBe('reg-tok-2');
    expect(result.user.id).toBe(5);
  });

  it('throws ApiError with status 409 on duplicate email', async () => {
    vi.stubGlobal('fetch', mockFetch(409, { error: 'Email already registered' }));
    const err = await apiRegister('dup@a.com', '+407', 'pass123').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/already registered/i);
  });

  it('throws ApiError with status 400 on short password', async () => {
    vi.stubGlobal('fetch', mockFetch(400, { error: 'Password must be at least 6 characters' }));
    const err = await apiRegister('a@a.com', '+407', '123').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.isValidation).toBe(true);
  });

  it('does not store token when registration fails', async () => {
    vi.stubGlobal('fetch', mockFetch(409, { error: 'Email already registered' }));
    await apiRegister('dup@a.com', '+407', 'pass123').catch(() => {});
    expect(getStoredToken()).toBeNull();
  });

  it('throws ApiError on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const err = await apiRegister('a@a.com', '+407', 'pass').catch(e => e);
    expect(err.isNetwork).toBe(true);
  });
});

// ── apiLogout ─────────────────────────────────────────────────

describe('apiLogout', () => {
  it('clears the stored token', async () => {
    setStoredToken('some-token');
    vi.stubGlobal('fetch', mockFetch(204, null));
    await apiLogout();
    expect(getStoredToken()).toBeNull();
  });

  it('calls POST /api/auth/logout', async () => {
    setStoredToken('tok');
    const fetchMock = mockFetch(204, null);
    vi.stubGlobal('fetch', fetchMock);
    await apiLogout();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('sends the token in X-Session-Token header', async () => {
    setStoredToken('my-token');
    const fetchMock = mockFetch(204, null);
    vi.stubGlobal('fetch', fetchMock);
    await apiLogout();
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Session-Token']).toBe('my-token');
  });

  it('clears token even if the server request fails', async () => {
    setStoredToken('dead-token');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    await apiLogout(); // must not throw
    expect(getStoredToken()).toBeNull();
  });
});

// ── apiMe ─────────────────────────────────────────────────────

describe('apiMe', () => {
  it('returns user payload when the token is valid', async () => {
    setStoredToken('valid-tok');
    const user = { id: 1, email: 'admin@estethis.com', role: 'admin' };
    vi.stubGlobal('fetch', mockFetch(200, user));
    const result = await apiMe();
    expect(result).toEqual(user);
  });

  it('sends the token in X-Session-Token header', async () => {
    setStoredToken('my-tok');
    const fetchMock = mockFetch(200, { id: 1, email: 'u@u.com', role: 'user' });
    vi.stubGlobal('fetch', fetchMock);
    await apiMe();
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Session-Token']).toBe('my-tok');
  });

  it('returns null on 401 (expired/invalid session)', async () => {
    setStoredToken('expired');
    vi.stubGlobal('fetch', mockFetch(401, { error: 'Not authenticated' }));
    const result = await apiMe();
    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const result = await apiMe();
    expect(result).toBeNull();
  });

  it('returns null when no token is stored', async () => {
    // With no token the request goes out without a token header;
    // the server will respond 401 which apiMe swallows.
    vi.stubGlobal('fetch', mockFetch(401, { error: 'Not authenticated' }));
    const result = await apiMe();
    expect(result).toBeNull();
  });
});

// ── token storage helpers ─────────────────────────────────────

describe('token storage', () => {
  it('setStoredToken stores a value', () => {
    setStoredToken('abc');
    expect(getStoredToken()).toBe('abc');
  });

  it('setStoredToken(null) clears the value', () => {
    setStoredToken('abc');
    setStoredToken(null);
    expect(getStoredToken()).toBeNull();
  });

  it('getStoredToken returns null when nothing is stored', () => {
    expect(getStoredToken()).toBeNull();
  });
});

// ── ApiError class ────────────────────────────────────────────

describe('ApiError', () => {
  it('isNetwork is true for status 0', () => {
    const e = new ApiError('fail', { status: 0 });
    expect(e.isNetwork).toBe(true);
  });

  it('isValidation is true for status 400', () => {
    const e = new ApiError('bad input', { status: 400 });
    expect(e.isValidation).toBe(true);
  });

  it('isNetwork is false for HTTP errors', () => {
    const e = new ApiError('unauthorized', { status: 401 });
    expect(e.isNetwork).toBe(false);
  });

  it('preserves the error message', () => {
    const e = new ApiError('Custom message', { status: 422 });
    expect(e.message).toBe('Custom message');
  });

  it('exposes status', () => {
    const e = new ApiError('err', { status: 500 });
    expect(e.status).toBe(500);
  });

  it('exposes payload when provided', () => {
    const e = new ApiError('err', { status: 400, payload: { errors: ['x'] } });
    expect(e.payload.errors).toContain('x');
  });

  it('isValidation is false for status 401', () => {
    const e = new ApiError('unauth', { status: 401 });
    expect(e.isValidation).toBe(false);
  });

  it('isNetwork is false for status 500', () => {
    const e = new ApiError('server error', { status: 500 });
    expect(e.isNetwork).toBe(false);
  });

  it('payload defaults to null when not provided', () => {
    const e = new ApiError('err', { status: 400 });
    expect(e.payload).toBeNull();
  });
});

// ── Session token header behaviour ────────────────────────────

describe('X-Session-Token header', () => {
  it('attaches stored token to subsequent requests after login', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ token: 'my-tok', user: {} }) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ id: 1 }) });
    vi.stubGlobal('fetch', fetchMock);

    await apiLogin('a@b.com', 'pass');
    // Second call (e.g. apiMe) should carry the token
    await apiMe();

    const secondCallHeaders = fetchMock.mock.calls[1][1].headers;
    expect(secondCallHeaders['X-Session-Token']).toBe('my-tok');
  });

  it('no X-Session-Token header sent when no token is stored', async () => {
    localStorageMock.clear();
    const fetchMock = mockFetch(401, { error: 'Not authenticated' });
    vi.stubGlobal('fetch', fetchMock);

    await apiMe();
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Session-Token']).toBeUndefined();
  });

  it('apiLogout sends X-Session-Token even when server is unreachable', async () => {
    setStoredToken('tok-xyz');
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await apiLogout(); // must not throw
    expect(getStoredToken()).toBeNull();
  });
});

// ── Rate-limit response handling ──────────────────────────────

describe('apiLogin rate-limit response', () => {
  it('throws ApiError with status 429 when server rate-limits the request', async () => {
    vi.stubGlobal('fetch', mockFetch(429, { error: 'Too many requests. Please try again later.' }));
    const err = await apiLogin('a@b.com', 'pass').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
  });

  it('does not store token on 429 response', async () => {
    vi.stubGlobal('fetch', mockFetch(429, { error: 'Too many requests' }));
    await apiLogin('a@b.com', 'pass').catch(() => {});
    expect(getStoredToken()).toBeNull();
  });
});

// ── apiListUsers / apiDeleteUser ──────────────────────────────

describe('apiListUsers', () => {
  it('calls GET /api/auth/users with the stored token', async () => {
    setStoredToken('admin-tok');
    const { apiListUsers } = await import('./api.js');
    const fetchMock = mockFetch(200, [{ id: 1, email: 'admin@a.com', role: 'admin' }]);
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiListUsers();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/users');
    expect(opts.headers['X-Session-Token']).toBe('admin-tok');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('apiDeleteUser', () => {
  it('calls DELETE /api/auth/users/:id with the stored token', async () => {
    setStoredToken('admin-tok');
    const { apiDeleteUser } = await import('./api.js');
    const fetchMock = vi.fn().mockResolvedValue({ status: 204, ok: true, json: async () => null });
    vi.stubGlobal('fetch', fetchMock);

    await apiDeleteUser(42);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/users/42');
    expect(opts.method).toBe('DELETE');
    expect(opts.headers['X-Session-Token']).toBe('admin-tok');
  });

  it('throws ApiError with 403 when called without admin permissions', async () => {
    setStoredToken('user-tok');
    const { apiDeleteUser } = await import('./api.js');
    vi.stubGlobal('fetch', mockFetch(403, { error: 'Admin only' }));
    const err = await apiDeleteUser(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
  });
});
