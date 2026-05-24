// ─────────────────────────────────────────────────────────────
// ROUTES — endpoint declarations (Bronze + Silver)
// More-specific paths declared before /:id to avoid conflicts.
//
// Access control:
//   reads        → requireAuth (any logged-in user)
//   writes       → requireAuth + requirePermission('products:write')
//   generator    → requireAuth + requirePermission('generator:manage')
// ─────────────────────────────────────────────────────────────

import { Router }          from 'express';
import controller          from './controller.js';
import { syncController }  from './syncController.js';
import * as generator      from './generator.js';
import { validateProduct } from './validator.js';
import { requireAuth, requirePermission } from './authMiddleware.js';

const router = Router();

const canWrite    = [requireAuth, requirePermission('products:write')];
const canGenerate = [requireAuth, requirePermission('generator:manage')];

// ── Silver: more-specific paths FIRST ─────────────────────────
router.get ('/stats', requireAuth, controller.getStats);
router.post('/sync',  ...canWrite,  syncController);

router.get ('/generator',       requireAuth,     (_req, res) => res.json(generator.status()));
router.post('/generator/start', ...canGenerate,  (req,  res) => {
  try { res.json(generator.start(req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
router.post('/generator/stop',  ...canGenerate, (_req, res) => res.json(generator.stop()));
router.post('/generator/tick',  ...canGenerate, async (req, res) => {
  const n     = Number(req.body?.batchSize);
  const batch = await generator.tickOnce(Number.isFinite(n) && n > 0 ? n : undefined);
  res.json({ generated: batch.length, items: batch });
});

// ── Bronze CRUD ────────────────────────────────────────────────
router.get   ('/',     requireAuth,   controller.getAll);
router.get   ('/:id',  requireAuth,   controller.getById);
router.post  ('/',     ...canWrite,   validateProduct, controller.create);
router.put   ('/:id',  ...canWrite,   validateProduct, controller.update);
router.delete('/:id',  ...canWrite,   controller.delete);

export default router;
