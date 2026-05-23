// ─────────────────────────────────────────────────────────────
// GRAPHQL RESOLVERS — delegates to the same async repositories
// the REST API uses; both transports share identical logic.
// ─────────────────────────────────────────────────────────────

import repository     from '../repository.js';
import reviewsRepo    from '../reviewsRepo.js';
import * as generator from '../generator.js';
import { events, EVENTS } from '../events.js';
import { validateReviewData } from '../reviewValidator.js';

function pageMeta(total, page, limit) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { total, page, limit, totalPages, hasMore: page < totalPages };
}

function gqlError(msg) {
  const err = new Error(msg);
  err.extensions = { code: 'BAD_USER_INPUT' };
  return err;
}

export const resolvers = {
  // ── Query ────────────────────────────────────────────────────
  Query: {
    async products(_parent, { page = 1, limit = 10, search, sort }) {
      let { data: all } = await repository.getAll(1, 9999);

      if (search?.trim()) {
        const q = search.trim().toLowerCase();
        all = all.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.colors.some((c) => c.toLowerCase().includes(q))
        );
      }
      if (sort === 'price-asc')  all = [...all].sort((a, b) => a.price - b.price);
      if (sort === 'price-desc') all = [...all].sort((a, b) => b.price - a.price);
      if (sort === 'name-asc')   all = [...all].sort((a, b) => a.name.localeCompare(b.name));
      if (sort === 'name-desc')  all = [...all].sort((a, b) => b.name.localeCompare(a.name));

      const total = all.length;
      const p = parseInt(page,  10);
      const l = parseInt(limit, 10);
      const start = (p - 1) * l;
      return { data: all.slice(start, start + l), ...pageMeta(total, p, l) };
    },

    product(_parent, { id }) {
      return repository.getById(id);
    },

    async productStats() {
      const raw = await repository.getStats();
      return {
        byCategory:    Object.entries(raw.byCategory).map(([category, count]) => ({ category, count })),
        totalProducts: raw.totalProducts,
        totalStock:    raw.totalStock,
        totalValue:    raw.totalValue,
      };
    },

    reviews(_parent, { productId, page = 1, limit = 10 }) {
      return reviewsRepo.getByProductId(productId, page, limit);
    },

    review(_parent, { id }) {
      return reviewsRepo.getById(id);
    },

    async reviewStats(_parent, { productId }) {
      return { productId, ...await reviewsRepo.statsForProduct(productId) };
    },

    generatorStatus() {
      return generator.status();
    },
  },

  // ── Mutation ─────────────────────────────────────────────────
  Mutation: {
    async createProduct(_parent, { input }) {
      const errs = [];
      if (!input.name || input.name.trim().length < 2) errs.push('name: required, minimum 2 characters.');
      if (input.price === undefined || input.price < 0)  errs.push('price: must be a non-negative number.');
      const CATS = ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Accessories', 'Other'];
      if (!CATS.includes(input.category)) errs.push(`category: must be one of ${CATS.join(', ')}.`);
      if (errs.length) throw gqlError(errs.join(' '));
      const product = await repository.create(input);
      events.emit(EVENTS.PRODUCT_CREATED, product);
      return product;
    },

    async updateProduct(_parent, { id, input }) {
      const updated = await repository.update(id, input);
      if (!updated) throw gqlError(`Product ${id} not found.`);
      events.emit(EVENTS.PRODUCT_UPDATED, updated);
      return updated;
    },

    async deleteProduct(_parent, { id }) {
      const ok = await repository.delete(id);
      if (!ok) throw gqlError(`Product ${id} not found.`);
      await reviewsRepo.removeByProductId(id);
      events.emit(EVENTS.PRODUCT_DELETED, { id });
      return true;
    },

    async createReview(_parent, { productId, input }) {
      if (!await repository.getById(productId))
        throw gqlError(`Product ${productId} not found.`);
      const errors = validateReviewData(input);
      if (errors.length) throw gqlError(errors.join(' '));
      return reviewsRepo.create({ ...input, productId });
    },

    async updateReview(_parent, { id, input }) {
      const errors = validateReviewData(input);
      if (errors.length) throw gqlError(errors.join(' '));
      const updated = await reviewsRepo.update(id, input);
      if (!updated) throw gqlError(`Review ${id} not found.`);
      return updated;
    },

    async deleteReview(_parent, { id }) {
      const ok = await reviewsRepo.delete(id);
      if (!ok) throw gqlError(`Review ${id} not found.`);
      return true;
    },

    startGenerator(_parent, { intervalMs, batchSize }) {
      return generator.start({ intervalMs, batchSize });
    },

    stopGenerator() {
      return generator.stop();
    },

    tickGenerator(_parent, { batchSize }) {
      return generator.tickOnce(batchSize);
    },
  },

  // ── Type resolvers ────────────────────────────────────────────
  Product: {
    reviews(product, { page = 1, limit = 10 }) {
      return reviewsRepo.getByProductId(product.id, page, limit);
    },
    async reviewStats(product) {
      return { productId: product.id, ...await reviewsRepo.statsForProduct(product.id) };
    },
  },

  Review: {
    product(review) {
      return repository.getById(review.productId);
    },
  },

  ProductPage: {
    totalPages: (p) => Math.max(1, Math.ceil(p.total / p.limit)),
    hasMore:    (p) => p.page < Math.max(1, Math.ceil(p.total / p.limit)),
  },

  ReviewPage: {
    totalPages: (p) => Math.max(1, Math.ceil(p.total / p.limit)),
    hasMore:    (p) => p.page < Math.max(1, Math.ceil(p.total / p.limit)),
  },
};
