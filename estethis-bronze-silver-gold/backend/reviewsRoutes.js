// ─────────────────────────────────────────────────────────────
// REVIEWS ROUTES (Gold — 1-to-many)
// All handlers are async (DB-backed repositories).
// ─────────────────────────────────────────────────────────────

import { Router }         from 'express';
import reviewsRepo        from './reviewsRepo.js';
import repository         from './repository.js';
import { validateReview } from './reviewValidator.js';

const router = Router();

// ── Nested under /api/products/:productId/reviews ───────────
router.get('/products/:productId/reviews/stats', async (req, res) => {
  const { productId } = req.params;
  if (!await repository.getById(productId))
    return res.status(404).json({ error: 'Product not found.' });
  res.json({ productId: parseInt(productId, 10), ...await reviewsRepo.statsForProduct(productId) });
});

router.get('/products/:productId/reviews', async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  if (!await repository.getById(productId))
    return res.status(404).json({ error: 'Product not found.' });
  res.json(await reviewsRepo.getByProductId(productId, page, limit));
});

router.post('/products/:productId/reviews', validateReview, async (req, res) => {
  const { productId } = req.params;
  if (!await repository.getById(productId))
    return res.status(404).json({ error: 'Product not found.' });
  const review = await reviewsRepo.create({ ...req.body, productId });
  res.status(201).json(review);
});

// ── Top-level /api/reviews/:id ───────────────────────────────
router.get('/reviews/:id', async (req, res) => {
  const review = await reviewsRepo.getById(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found.' });
  res.json(review);
});

router.put('/reviews/:id', validateReview, async (req, res) => {
  const updated = await reviewsRepo.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Review not found.' });
  res.json(updated);
});

router.delete('/reviews/:id', async (req, res) => {
  const ok = await reviewsRepo.delete(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Review not found.' });
  res.status(204).send();
});

export default router;
