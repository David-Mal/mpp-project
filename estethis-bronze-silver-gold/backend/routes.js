// ─────────────────────────────────────────────────────────────
// ROUTES — endpoint declarations (Bronze + Silver)
// More-specific paths declared before /:id to avoid conflicts.
// ─────────────────────────────────────────────────────────────

import { Router }          from 'express';
import controller          from './controller.js';
import { syncController }  from './syncController.js';
import * as generator      from './generator.js';
import { validateProduct } from './validator.js';

const router = Router();

// ── Silver: more-specific paths FIRST ─────────────────────────
router.get ('/stats', controller.getStats);
router.post('/sync',  syncController);

router.get ('/generator',       (_req, res) => res.json(generator.status()));
router.post('/generator/start', (req,  res) => {
  try { res.json(generator.start(req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
router.post('/generator/stop',  (_req, res) => res.json(generator.stop()));
router.post('/generator/tick',  async (req, res) => {
  const n     = Number(req.body?.batchSize);
  const batch = await generator.tickOnce(Number.isFinite(n) && n > 0 ? n : undefined);
  res.json({ generated: batch.length, items: batch });
});

// ── Bronze CRUD ────────────────────────────────────────────────
router.get   ('/',     controller.getAll);
router.get   ('/:id',  controller.getById);
router.post  ('/',     validateProduct, controller.create);
router.put   ('/:id',  validateProduct, controller.update);
router.delete('/:id',  controller.delete);

export default router;
