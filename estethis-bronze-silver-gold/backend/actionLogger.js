// ─────────────────────────────────────────────────────────────
// ACTION LOGGER (Step 3 — Gold)
//
// Captures every request made by a logged-in user and persists:
//   USER_ID        → req.user.id
//   GROUP_ID       → req.user.role  ('admin' | 'user')
//   ACTION_INFO    → human-readable description of what was done
//   TIMESTAMP      → createdAt (auto by Sequelize)
//
// Two parts:
//   logUserAction(userId, groupId, actionInfo)
//     — standalone helper called explicitly for login/register
//       (where req.user isn't set yet from the session)
//
//   actionLoggerMiddleware
//     — Express middleware, mounted globally after loadUser.
//       Fires on `res.finish` so it never blocks the response.
// ─────────────────────────────────────────────────────────────

import { ActionLog } from './models/index.js';
// Imported lazily to avoid circular-import issues at module load time.
let _runThreatDetection;
async function getThreatDetector() {
  if (!_runThreatDetection) {
    ({ runThreatDetection: _runThreatDetection } = await import('./threatDetector.js'));
  }
  return _runThreatDetection;
}

// ── Standalone helper ────────────────────────────────────────

export async function logUserAction(userId, groupId, actionInfo) {
  try {
    await ActionLog.create({ userId, groupId, actionInfo });
    // After persisting the action, run threat detection asynchronously.
    getThreatDetector()
      .then(fn => fn(userId))
      .catch(() => {});
  } catch (err) {
    console.error('[action-log] write failed:', err.message);
  }
}

// ── Human-readable action description ────────────────────────

export function buildActionInfo(req) {
  const method = req.method;
  const url    = (req.originalUrl || req.url || '').split('?')[0];
  const body   = req.body ?? {};

  // ── Auth ──────────────────────────────────────────────────
  if (url === '/api/auth/logout')                         return 'Logged out';
  if (url === '/api/auth/me')                             return 'Viewed own profile';
  if (url === '/api/auth/users'  && method === 'GET')     return 'Admin: listed all users';
  const delUser = url.match(/^\/api\/auth\/users\/(\d+)$/);
  if (delUser && method === 'DELETE')                     return `Admin: deleted user #${delUser[1]}`;

  // ── Products ──────────────────────────────────────────────
  if (url === '/api/products' && method === 'GET')        return 'Listed products';
  if (url === '/api/products' && method === 'POST')       return `Created product: "${body.name ?? 'unknown'}"`;
  if (url === '/api/products/stats')                      return 'Viewed product statistics';
  if (url === '/api/products/sync' && method === 'POST')  return `Synced ${body.operations?.length ?? 0} offline operations`;
  if (url === '/api/products/generator/start')            return 'Started product generator';
  if (url === '/api/products/generator/stop')             return 'Stopped product generator';
  if (url === '/api/products/generator/tick')             return `Generator tick (count=${body.count ?? 1})`;
  const prod = url.match(/^\/api\/products\/(\d+)$/);
  if (prod) {
    const id = prod[1];
    if (method === 'GET')    return `Viewed product #${id}`;
    if (method === 'PUT')    return `Updated product #${id}: "${body.name ?? 'unknown'}"`;
    if (method === 'DELETE') return `Deleted product #${id}`;
  }

  // ── Reviews ───────────────────────────────────────────────
  const rev = url.match(/^\/api\/products\/(\d+)\/reviews(?:\/(\d+))?$/);
  if (rev) {
    const [, pid, rid] = rev;
    if (method === 'GET')    return `Viewed reviews for product #${pid}`;
    if (method === 'POST')   return `Submitted review for product #${pid}`;
    if (method === 'PUT')    return `Updated review #${rid} on product #${pid}`;
    if (method === 'DELETE') return `Deleted review #${rid} on product #${pid}`;
  }

  // ── Chat ──────────────────────────────────────────────────
  if (url.startsWith('/api/chat/history'))                return `Loaded chat history`;

  // ── Admin ─────────────────────────────────────────────────
  if (url.startsWith('/api/admin/logs'))                  return 'Admin: viewed action logs';
  if (url.startsWith('/api/admin/observation') && method === 'GET')    return 'Admin: viewed observation list';
  if (url.match(/^\/api\/admin\/observation\/\d+$/) && method === 'DELETE') return 'Admin: resolved observation entry';

  // ── GraphQL ───────────────────────────────────────────────
  if (url === '/graphql')                                 return 'GraphQL request';

  // ── Fallback ──────────────────────────────────────────────
  return `${method} ${url}`;
}

// ── Express middleware (global, after loadUser) ───────────────

export function actionLoggerMiddleware(req, res, next) {
  if (!req.user) { next(); return; }

  // Capture action info from the request before any async processing.
  const actionInfo = buildActionInfo(req);
  const { id: userId, role: groupId } = req.user;

  res.on('finish', () => {
    // Log all 2xx responses and 3xx; skip 4xx/5xx noise.
    // Exception: always log 401/403 on sensitive admin endpoints
    // so the audit trail is complete.
    const doLog = res.statusCode < 400
      || (res.statusCode === 403 && actionInfo.startsWith('Admin:'));
    if (doLog) {
      logUserAction(userId, groupId, actionInfo).catch(() => {});
    }
  });

  next();
}
