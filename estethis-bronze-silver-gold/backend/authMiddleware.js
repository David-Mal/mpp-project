import { getSession } from './session.js';

export function loadUser(req, _res, next) {
  const token = req.headers['x-session-token'];
  req.user = token ? getSession(token) : null;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

/**
 * Middleware factory — rejects requests where the authenticated user's
 * permission set does not include `perm`.
 *
 * Usage:  router.post('/foo', requireAuth, requirePermission('products:write'), handler)
 */
export function requirePermission(perm) {
  return function permissionGuard(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!Array.isArray(req.user.permissions) || !req.user.permissions.includes(perm)) {
      return res.status(403).json({ error: `Permission denied: ${perm}` });
    }
    next();
  };
}
