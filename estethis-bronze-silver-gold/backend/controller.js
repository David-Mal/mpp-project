// ─────────────────────────────────────────────────────────────
// CONTROLLER — handles HTTP request/response, delegates to repository
// All handlers are async because the repository layer is DB-backed.
// ─────────────────────────────────────────────────────────────

import repository    from './repository.js';
import reviewsRepo   from './reviewsRepo.js';
import { events, EVENTS } from './events.js';

const controller = {
  // GET /api/products?page=1&limit=10&search=&sort=&category=&minPrice=&maxPrice=&inStock=
  async getAll(req, res) {
    const { page = 1, limit = 10, search, sort, category, minPrice, maxPrice, inStock } = req.query;

    let { data: all } = await repository.getAll(1, 99999);

    // ── Filters ──────────────────────────────────────────────
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      all = all.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.colors || []).some((c) => c.toLowerCase().includes(q))
      );
    }
    if (category) {
      all = all.filter((p) => p.category === category);
    }
    if (minPrice !== undefined && !isNaN(parseFloat(minPrice))) {
      all = all.filter((p) => p.price >= parseFloat(minPrice));
    }
    if (maxPrice !== undefined && !isNaN(parseFloat(maxPrice))) {
      all = all.filter((p) => p.price <= parseFloat(maxPrice));
    }
    if (inStock === 'true') {
      all = all.filter((p) => p.stock > 0);
    }

    // ── Sort ─────────────────────────────────────────────────
    if (sort === 'price-asc')  all = [...all].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') all = [...all].sort((a, b) => b.price - a.price);
    if (sort === 'name-asc')   all = [...all].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'name-desc')  all = [...all].sort((a, b) => b.name.localeCompare(a.name));

    const total = all.length;
    const p = parseInt(page,  10);
    const l = parseInt(limit, 10);
    const start = (p - 1) * l;
    res.json({ data: all.slice(start, start + l), total, page: p, limit: l });
  },

  // GET /api/products/stats
  async getStats(_req, res) {
    res.json(await repository.getStats());
  },

  // GET /api/products/:id
  async getById(req, res) {
    const product = await repository.getById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produsul nu a fost găsit.' });
    res.json(product);
  },

  // POST /api/products
  async create(req, res) {
    const product = await repository.create(req.body);
    events.emit(EVENTS.PRODUCT_CREATED, product);
    res.status(201).json(product);
  },

  // PUT /api/products/:id
  async update(req, res) {
    const product = await repository.update(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: 'Produsul nu a fost găsit.' });
    events.emit(EVENTS.PRODUCT_UPDATED, product);
    res.json(product);
  },

  // DELETE /api/products/:id
  async delete(req, res) {
    const id = parseInt(req.params.id, 10);
    const ok = await repository.delete(id);
    if (!ok) return res.status(404).json({ error: 'Produsul nu a fost găsit.' });
    // DB cascade removes reviews automatically; explicit call keeps the event bus aware.
    await reviewsRepo.removeByProductId(id);
    events.emit(EVENTS.PRODUCT_DELETED, { id });
    res.status(204).send();
  },
};

export default controller;
