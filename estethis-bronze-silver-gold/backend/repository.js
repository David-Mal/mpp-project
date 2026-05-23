// ─────────────────────────────────────────────────────────────
// REPOSITORY — Sequelize-backed persistence for Products.
//
// 3NF schema: colors / sizes / features live in their own tables
// (product_colors, product_sizes, product_features) so every
// non-key column depends only on its own primary key.
//
// All methods are async; callers must await them.
// ─────────────────────────────────────────────────────────────

import { Product, ProductColor, ProductSize, ProductFeature, Review, sequelize }
  from './models/index.js';

// ── Eager-load spec — always fetch associations with the product ──
// `separate: true` issues per-model SELECT queries so we can specify
// ORDER BY on each child table independently (preserves insertion order).
const WITH_ASSOC = [
  { model: ProductColor,   attributes: ['color'],                 separate: true, order: [['id', 'ASC']] },
  { model: ProductSize,    attributes: ['size'],                  separate: true, order: [['id', 'ASC']] },
  { model: ProductFeature, attributes: ['feature', 'sortOrder'],  separate: true, order: [['sort_order', 'ASC']] },
];

// ── Shape a Sequelize instance into the plain JS object the rest  ──
// ── of the app (controllers, GraphQL, tests) expects.             ──
function toPlain(p) {
  const d = p.get ? p.get({ plain: true }) : p;
  return {
    id:          d.id,
    name:        d.name,
    category:    d.category,
    price:       parseFloat(d.price),
    stock:       d.stock ?? 0,
    description: d.description ?? '',
    image:       d.image ?? '',
    colors:   (d.ProductColors   ?? []).map((c) => c.color),
    sizes:    (d.ProductSizes    ?? []).map((s) => s.size),
    features: (d.ProductFeatures ?? [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((f) => f.feature),
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  };
}

// ── Reset the auto-increment counter so test IDs start at 1 again ──
async function resetSequence() {
  const dialect = sequelize.getDialect();
  if (dialect === 'sqlite') {
    await sequelize.query("DELETE FROM sqlite_sequence WHERE name='products'").catch(() => {});
    await sequelize.query("DELETE FROM sqlite_sequence WHERE name='reviews'").catch(() => {});
  } else if (dialect === 'postgres') {
    await sequelize.query('ALTER SEQUENCE IF EXISTS products_id_seq RESTART WITH 1').catch(() => {});
    await sequelize.query('ALTER SEQUENCE IF EXISTS reviews_id_seq  RESTART WITH 1').catch(() => {});
  }
}

const repository = {
  // ── Reset (tests) ────────────────────────────────────────────
  async clear() {
    // Delete child rows first so SQLite's FK checks pass.
    await ProductColor.destroy({ where: {} });
    await ProductSize.destroy({ where: {} });
    await ProductFeature.destroy({ where: {} });
    await Review.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await resetSequence();
  },

  // ── Seed ────────────────────────────────────────────────────
  async seed(items) {
    await this.clear();
    for (const item of items) {
      await this.create(item);
    }
  },

  // ── READ (paginated) ─────────────────────────────────────────
  async getAll(page = 1, limit = 10) {
    const p = parseInt(page,  10);
    const l = parseInt(limit, 10);
    const { count, rows } = await Product.findAndCountAll({
      include:  WITH_ASSOC,
      order:    [['id', 'ASC']],
      offset:   l > 0 ? (p - 1) * l : 0,
      limit:    l > 0 ? l : undefined,
    });
    return { data: rows.map(toPlain), total: count, page: p, limit: l };
  },

  // ── READ (single) ────────────────────────────────────────────
  async getById(id) {
    const p = await Product.findByPk(parseInt(id, 10), { include: WITH_ASSOC });
    return p ? toPlain(p) : null;
  },

  // ── READ (count only — used by health endpoint) ───────────────
  async count() {
    return Product.count();
  },

  // ── CREATE ───────────────────────────────────────────────────
  async create(data) {
    const p = await Product.create({
      name:        String(data.name).trim(),
      category:    data.category,
      price:       parseFloat(parseFloat(data.price).toFixed(2)),
      stock:       parseInt(data.stock ?? 0, 10),
      description: data.description ?? '',
      image:       data.image ?? '',
    });

    const colors   = Array.isArray(data.colors)   ? data.colors   : [];
    const sizes    = Array.isArray(data.sizes)    ? data.sizes    : [];
    const features = Array.isArray(data.features) ? data.features : [];

    if (colors.length)
      await ProductColor.bulkCreate(colors.map((color) => ({ productId: p.id, color })));
    if (sizes.length)
      await ProductSize.bulkCreate(sizes.map((size) => ({ productId: p.id, size })));
    if (features.length)
      await ProductFeature.bulkCreate(
        features.map((feature, i) => ({ productId: p.id, feature, sortOrder: i }))
      );

    return this.getById(p.id);
  },

  // ── UPDATE ───────────────────────────────────────────────────
  async update(id, data) {
    const p = await Product.findByPk(parseInt(id, 10));
    if (!p) return null;

    await p.update({
      name:        String(data.name).trim(),
      category:    data.category,
      price:       parseFloat(parseFloat(data.price).toFixed(2)),
      stock:       data.stock      !== undefined ? parseInt(data.stock, 10)    : p.stock,
      description: data.description !== undefined ? data.description           : p.description,
      image:       data.image       !== undefined ? data.image                 : p.image,
    });

    if (Array.isArray(data.colors)) {
      await ProductColor.destroy({ where: { productId: p.id } });
      if (data.colors.length)
        await ProductColor.bulkCreate(data.colors.map((color) => ({ productId: p.id, color })));
    }
    if (Array.isArray(data.sizes)) {
      await ProductSize.destroy({ where: { productId: p.id } });
      if (data.sizes.length)
        await ProductSize.bulkCreate(data.sizes.map((size) => ({ productId: p.id, size })));
    }
    if (Array.isArray(data.features)) {
      await ProductFeature.destroy({ where: { productId: p.id } });
      if (data.features.length)
        await ProductFeature.bulkCreate(
          data.features.map((feature, i) => ({ productId: p.id, feature, sortOrder: i }))
        );
    }

    return this.getById(p.id);
  },

  // ── DELETE ───────────────────────────────────────────────────
  async delete(id) {
    // Child rows (colors, sizes, features, reviews) cascade via FK.
    const rows = await Product.destroy({ where: { id: parseInt(id, 10) } });
    return rows > 0;
  },

  // ── STATISTICS ───────────────────────────────────────────────
  // For PostgreSQL the stored function get_product_stats() is used;
  // for SQLite a raw aggregate query is used (identical semantics).
  async getStats() {
    const dialect = sequelize.getDialect();
    let rows;

    if (dialect === 'postgres') {
      rows = await sequelize.query('SELECT * FROM get_product_stats()', {
        type: sequelize.QueryTypes.SELECT,
      });
    } else {
      rows = await sequelize.query(
        `SELECT category,
                COUNT(*)                       AS cnt,
                ROUND(AVG(price), 2)           AS avg_price,
                COALESCE(SUM(stock), 0)        AS total_stock,
                ROUND(SUM(price * stock), 2)   AS total_value
         FROM products
         GROUP BY category`,
        { type: sequelize.QueryTypes.SELECT }
      );
    }

    const byCategory = {};
    let totalStock = 0;
    let totalValue = 0;

    for (const row of rows) {
      byCategory[row.category] = parseInt(row.cnt ?? row.count, 10);
      totalStock += parseInt(row.total_stock, 10) || 0;
      totalValue += parseFloat(row.total_value  || 0);
    }

    const totalProducts = await Product.count();
    return {
      byCategory,
      totalProducts,
      totalStock,
      totalValue: parseFloat(totalValue.toFixed(2)),
    };
  },
};

export default repository;
