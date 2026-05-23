import { Router }   from 'express';
import { Op }        from 'sequelize';
import { loadUser, requireAdmin } from './authMiddleware.js';
import { ActionLog, ObservationEntry, User } from './models/index.js';

const router = Router();

// All admin endpoints require authentication + admin role.
router.use(loadUser, requireAdmin);

// ── GET /api/admin/logs ───────────────────────────────────────
// Returns paginated action logs with optional filters.
// Query params:
//   page     (default 1)
//   limit    (default 50, max 200)
//   userId   filter by user ID
//   groupId  filter by role ('admin' | 'user')
//   search   substring match on action_info
router.get('/logs', async (req, res) => {
  const page    = Math.max(1, Number(req.query.page)  || 1);
  const limit   = Math.min(200, Number(req.query.limit) || 50);
  const offset  = (page - 1) * limit;

  const where = {};
  if (req.query.userId)  where.userId  = Number(req.query.userId);
  if (req.query.groupId) where.groupId = req.query.groupId;
  if (req.query.search)  where.actionInfo = { [Op.like]: `%${req.query.search}%` };

  const { count, rows } = await ActionLog.findAndCountAll({
    where,
    include: [{ model: User, attributes: ['email'] }],
    order:   [['created_at', 'DESC']],
    limit,
    offset,
  });

  res.json({
    data:  rows.map(r => ({
      id:         r.id,
      userId:     r.userId,
      userEmail:  r.User?.email ?? null,
      groupId:    r.groupId,
      actionInfo: r.actionInfo,
      createdAt:  r.createdAt,
    })),
    total:  count,
    page,
    limit,
    pages:  Math.ceil(count / limit),
  });
});

// ── GET /api/admin/observation ────────────────────────────────
// Returns the observation list.
// ?resolved=true  → include resolved entries
// ?resolved=false → active threats only (default)
router.get('/observation', async (req, res) => {
  const where = req.query.resolved === 'true' ? {} : { resolvedAt: null };
  const rows  = await ObservationEntry.findAll({
    where,
    include: [{ model: User, attributes: ['email'] }],
    order:   [['updated_at', 'DESC']],
  });
  res.json(rows.map(r => ({
    id:         r.id,
    userId:     r.userId,
    userEmail:  r.User?.email ?? null,
    reason:     r.reason,
    details:    r.details,
    resolvedAt: r.resolvedAt,
    createdAt:  r.createdAt,
    updatedAt:  r.updatedAt,
  })));
});

// ── DELETE /api/admin/observation/:id ─────────────────────────
// Admin resolves (clears) an observation entry.
router.delete('/observation/:id', async (req, res) => {
  const entry = await ObservationEntry.findByPk(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  await entry.update({ resolvedAt: new Date() });
  res.status(204).end();
});

export default router;
