// ─────────────────────────────────────────────────────────────
// REVIEWS REPOSITORY — Sequelize-backed, 1-to-many with products
// All methods are async; callers must await them.
// ─────────────────────────────────────────────────────────────

import { Review, sequelize } from './models/index.js';

function toPlain(r) {
  const d = r.get ? r.get({ plain: true }) : r;
  return {
    id:        d.id,
    productId: d.productId ?? d.product_id,
    author:    d.author,
    rating:    d.rating,
    comment:   d.comment,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  };
}

async function resetSequence() {
  const dialect = sequelize.getDialect();
  if (dialect === 'sqlite') {
    await sequelize.query("DELETE FROM sqlite_sequence WHERE name='reviews'").catch(() => {});
  } else if (dialect === 'postgres') {
    await sequelize.query('ALTER SEQUENCE IF EXISTS reviews_id_seq RESTART WITH 1').catch(() => {});
  }
}

const reviewsRepo = {
  // ── Reset (tests) ────────────────────────────────────────────
  async clear() {
    await Review.destroy({ where: {} });
    await resetSequence();
  },

  // ── Seed ────────────────────────────────────────────────────
  async seed(items) {
    await this.clear();
    for (const item of items) {
      await this.create(item);
    }
  },

  // ── READ (all — used in tests) ───────────────────────────────
  async getAll() {
    const rows = await Review.findAll({ order: [['id', 'ASC']] });
    return rows.map(toPlain);
  },

  // ── READ (single) ────────────────────────────────────────────
  async getById(id) {
    const r = await Review.findByPk(parseInt(id, 10));
    return r ? toPlain(r) : null;
  },

  // ── READ (paginated, newest first) ───────────────────────────
  async getByProductId(productId, page = 1, limit = 10) {
    const pid = parseInt(productId, 10);
    const p   = parseInt(page,      10);
    const l   = parseInt(limit,     10);

    const { count, rows } = await Review.findAndCountAll({
      where:   { productId: pid },
      order:   [['createdAt', 'DESC']],
      offset:  (p - 1) * l,
      limit:   l,
    });
    return { data: rows.map(toPlain), total: count, page: p, limit: l };
  },

  // ── STATS for one product ────────────────────────────────────
  async statsForProduct(productId) {
    const pid  = parseInt(productId, 10);
    const rows = await Review.findAll({ where: { productId: pid }, raw: true });
    const count = rows.length;
    if (count === 0) return { count: 0, avgRating: 0, distribution: [] };

    const sum  = rows.reduce((s, r) => s + r.rating, 0);
    const dist = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: rows.filter((r) => r.rating === star).length,
    }));
    return {
      count,
      avgRating: Math.round((sum / count) * 100) / 100,
      distribution: dist,
    };
  },

  // ── CREATE ───────────────────────────────────────────────────
  async create(data) {
    const r = await Review.create({
      productId: parseInt(data.productId, 10),
      author:    String(data.author).trim(),
      rating:    parseInt(data.rating, 10),
      comment:   String(data.comment).trim(),
    });
    return toPlain(r);
  },

  // ── UPDATE ───────────────────────────────────────────────────
  async update(id, data) {
    const r = await Review.findByPk(parseInt(id, 10));
    if (!r) return null;
    await r.update({
      author:  data.author  !== undefined ? String(data.author).trim()  : r.author,
      rating:  data.rating  !== undefined ? parseInt(data.rating, 10)   : r.rating,
      comment: data.comment !== undefined ? String(data.comment).trim() : r.comment,
    });
    return toPlain(r);
  },

  // ── DELETE ───────────────────────────────────────────────────
  async delete(id) {
    const rows = await Review.destroy({ where: { id: parseInt(id, 10) } });
    return rows > 0;
  },

  // ── CASCADE DELETE (explicit — also handled by DB FK) ────────
  async removeByProductId(productId) {
    return Review.destroy({ where: { productId: parseInt(productId, 10) } });
  },
};

export default reviewsRepo;
