// ─────────────────────────────────────────────────────────────
// DB LAYER TESTS — persistence layer coverage
//
// Tests the Sequelize-backed repository and reviewsRepo directly
// (no HTTP, no Express). Each test clears the SQLite :memory: DB
// so tests are fully isolated.
//
// Coverage areas:
//   • Product CRUD + associations (colors/sizes/features)
//   • 3NF: child rows in separate tables, properly loaded
//   • Pagination
//   • Search / filter / sort logic via controller helpers
//   • Statistics aggregation (getStats)
//   • Review CRUD + stats
//   • Cascade delete: deleting a product removes its reviews
//   • Sequence reset: IDs restart at 1 after clear()
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import repository  from './repository.js';
import reviewsRepo from './reviewsRepo.js';

const BASE_PRODUCT = {
  name:        'Test Jacket',
  category:    'Outerwear',
  price:       199.99,
  stock:       10,
  colors:      ['Black', 'Navy'],
  sizes:       ['S', 'M', 'L'],
  description: 'A fine jacket.',
  features:    ['Waterproof', 'Windproof'],
  image:       'https://example.com/img.jpg',
};

beforeEach(async () => {
  await repository.clear();
  await reviewsRepo.clear();
});

// ─────────────────────────────────────────────────────────────
//  PRODUCT CRUD
// ─────────────────────────────────────────────────────────────
describe('repository › create', () => {
  it('persists a product and returns it with all fields', async () => {
    const p = await repository.create(BASE_PRODUCT);
    expect(p.id).toBe(1);
    expect(p.name).toBe('Test Jacket');
    expect(p.category).toBe('Outerwear');
    expect(p.price).toBe(199.99);
    expect(p.stock).toBe(10);
    expect(p.colors).toEqual(['Black', 'Navy']);
    expect(p.sizes).toEqual(['S', 'M', 'L']);
    expect(p.features).toEqual(['Waterproof', 'Windproof']);
    expect(p.description).toBe('A fine jacket.');
    expect(p.image).toBe('https://example.com/img.jpg');
    expect(p.createdAt).toBeTruthy();
    expect(p.updatedAt).toBeTruthy();
  });

  it('stores colors / sizes / features in their own 3NF tables', async () => {
    // Verify that the 3NF child tables are populated.
    const { ProductColor, ProductSize, ProductFeature } = await import('./models/index.js');
    await repository.create(BASE_PRODUCT);
    expect(await ProductColor.count()).toBe(2);
    expect(await ProductSize.count()).toBe(3);
    expect(await ProductFeature.count()).toBe(2);
  });

  it('auto-assigns sequential IDs after clear', async () => {
    const a = await repository.create({ name: 'Alpha', price: 10, category: 'Tops' });
    const b = await repository.create({ name: 'Beta',  price: 20, category: 'Tops' });
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it('rounds price to 2 decimal places', async () => {
    const p = await repository.create({ name: 'Exact', price: 9.999, category: 'Tops' });
    expect(p.price).toBe(10); // 9.999 rounds to 10.00
  });

  it('defaults stock to 0 when omitted', async () => {
    const p = await repository.create({ name: 'No stock', price: 5, category: 'Tops' });
    expect(p.stock).toBe(0);
  });

  it('handles empty colors / sizes / features arrays', async () => {
    const p = await repository.create({ name: 'Bare', price: 5, category: 'Tops', colors: [], sizes: [], features: [] });
    expect(p.colors).toEqual([]);
    expect(p.sizes).toEqual([]);
    expect(p.features).toEqual([]);
  });
});

describe('repository › getById', () => {
  it('returns a product by id with all associations', async () => {
    await repository.create(BASE_PRODUCT);
    const p = await repository.getById(1);
    expect(p).not.toBeNull();
    expect(p.name).toBe('Test Jacket');
    expect(p.colors).toContain('Black');
  });

  it('returns null for unknown id', async () => {
    expect(await repository.getById(9999)).toBeNull();
  });
});

describe('repository › getAll (pagination)', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 7; i++) {
      await repository.create({ name: `Product ${i}`, price: i * 10, category: 'Tops', stock: i });
    }
  });

  it('returns all items on a large page', async () => {
    const { data, total } = await repository.getAll(1, 100);
    expect(total).toBe(7);
    expect(data).toHaveLength(7);
  });

  it('paginates correctly — page 1 of 3', async () => {
    const { data, total, page, limit } = await repository.getAll(1, 3);
    expect(total).toBe(7);
    expect(data).toHaveLength(3);
    expect(page).toBe(1);
    expect(limit).toBe(3);
  });

  it('paginates correctly — page 3 of 3 (partial)', async () => {
    const { data } = await repository.getAll(3, 3);
    expect(data).toHaveLength(1);
  });

  it('returns empty data for out-of-range page', async () => {
    const { data, total } = await repository.getAll(99, 10);
    expect(data).toHaveLength(0);
    expect(total).toBe(7);
  });
});

describe('repository › update', () => {
  beforeEach(async () => {
    await repository.create(BASE_PRODUCT);
  });

  it('updates scalar fields', async () => {
    const updated = await repository.update(1, { name: 'New Name', price: 50, category: 'Tops' });
    expect(updated.name).toBe('New Name');
    expect(updated.price).toBe(50);
    expect(updated.category).toBe('Tops');
  });

  it('replaces colors when new array is provided', async () => {
    const updated = await repository.update(1, {
      name: 'X', price: 10, category: 'Tops',
      colors: ['Red', 'Green', 'Blue'],
    });
    expect(updated.colors).toEqual(['Red', 'Green', 'Blue']);
  });

  it('replaces features preserving order', async () => {
    const updated = await repository.update(1, {
      name: 'X', price: 10, category: 'Tops',
      features: ['C', 'A', 'B'],
    });
    expect(updated.features).toEqual(['C', 'A', 'B']);
  });

  it('returns null for unknown id', async () => {
    expect(await repository.update(9999, { name: 'X', price: 1, category: 'Tops' })).toBeNull();
  });
});

describe('repository › delete', () => {
  it('deletes an existing product and returns true', async () => {
    await repository.create(BASE_PRODUCT);
    expect(await repository.delete(1)).toBe(true);
    expect(await repository.getById(1)).toBeNull();
  });

  it('returns false for unknown id', async () => {
    expect(await repository.delete(9999)).toBe(false);
  });

  it('cascades to child 3NF tables', async () => {
    const { ProductColor } = await import('./models/index.js');
    await repository.create(BASE_PRODUCT);
    await repository.delete(1);
    expect(await ProductColor.count()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  SEED
// ─────────────────────────────────────────────────────────────
describe('repository › seed', () => {
  it('inserts all items and resets IDs from 1', async () => {
    await repository.seed([
      { name: 'A', price: 10, category: 'Tops' },
      { name: 'B', price: 20, category: 'Bottoms' },
    ]);
    const { data, total } = await repository.getAll(1, 100);
    expect(total).toBe(2);
    expect(data[0].id).toBe(1);
    expect(data[1].id).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
//  STATISTICS
// ─────────────────────────────────────────────────────────────
describe('repository › getStats', () => {
  it('returns zeros when empty', async () => {
    const s = await repository.getStats();
    expect(s.totalProducts).toBe(0);
    expect(s.totalStock).toBe(0);
    expect(s.totalValue).toBe(0);
    expect(s.byCategory).toEqual({});
  });

  it('aggregates by category correctly', async () => {
    await repository.create({ name: 'A', price: 100, category: 'Tops',    stock: 5 });
    await repository.create({ name: 'B', price: 200, category: 'Tops',    stock: 3 });
    await repository.create({ name: 'C', price: 50,  category: 'Bottoms', stock: 2 });

    const s = await repository.getStats();
    expect(s.totalProducts).toBe(3);
    expect(s.byCategory).toEqual({ Tops: 2, Bottoms: 1 });
    expect(s.totalStock).toBe(10);
    // 100*5 + 200*3 + 50*2 = 500 + 600 + 100 = 1200
    expect(s.totalValue).toBe(1200);
  });

  it('handles products with zero stock', async () => {
    await repository.create({ name: 'A', price: 100, category: 'Tops', stock: 0 });
    const s = await repository.getStats();
    expect(s.totalValue).toBe(0);
    expect(s.totalStock).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  FILTER & SEARCH (via controller-level logic — covered by
//  REST tests; here we test the repository's raw getAll)
// ─────────────────────────────────────────────────────────────
describe('repository › getAll ordering', () => {
  it('returns items ordered by id ascending by default', async () => {
    await repository.create({ name: 'Zebra', price: 1, category: 'Tops' });
    await repository.create({ name: 'Alpha', price: 2, category: 'Tops' });
    const { data } = await repository.getAll(1, 10);
    expect(data[0].name).toBe('Zebra');
    expect(data[1].name).toBe('Alpha');
  });
});

// ─────────────────────────────────────────────────────────────
//  REVIEWS CRUD
// ─────────────────────────────────────────────────────────────
describe('reviewsRepo › create / getById / getAll', () => {
  beforeEach(async () => {
    await repository.create({ name: 'Shirt', price: 50, category: 'Tops' });
  });

  it('creates a review linked to a product', async () => {
    const r = await reviewsRepo.create({ productId: 1, author: 'Alice', rating: 5, comment: 'Great!' });
    expect(r.id).toBe(1);
    expect(r.productId).toBe(1);
    expect(r.author).toBe('Alice');
    expect(r.rating).toBe(5);
  });

  it('getById returns the review', async () => {
    await reviewsRepo.create({ productId: 1, author: 'Bob', rating: 4, comment: 'Good.' });
    const r = await reviewsRepo.getById(1);
    expect(r).not.toBeNull();
    expect(r.author).toBe('Bob');
  });

  it('getById returns null for unknown id', async () => {
    expect(await reviewsRepo.getById(999)).toBeNull();
  });

  it('getAll returns all reviews', async () => {
    await reviewsRepo.create({ productId: 1, author: 'A', rating: 5, comment: 'Nice!' });
    await reviewsRepo.create({ productId: 1, author: 'B', rating: 3, comment: 'Okay.' });
    const all = await reviewsRepo.getAll();
    expect(all).toHaveLength(2);
  });
});

describe('reviewsRepo › getByProductId (pagination)', () => {
  beforeEach(async () => {
    await repository.create({ name: 'Shirt', price: 50, category: 'Tops' });
    for (let i = 1; i <= 6; i++) {
      await reviewsRepo.create({ productId: 1, author: `User ${i}`, rating: i % 5 + 1, comment: `Comment ${i} here.` });
    }
  });

  it('returns paginated reviews for a product', async () => {
    const { data, total } = await reviewsRepo.getByProductId(1, 1, 4);
    expect(total).toBe(6);
    expect(data).toHaveLength(4);
  });

  it('returns second page correctly', async () => {
    const { data } = await reviewsRepo.getByProductId(1, 2, 4);
    expect(data).toHaveLength(2);
  });
});

describe('reviewsRepo › update', () => {
  beforeEach(async () => {
    await repository.create({ name: 'Shirt', price: 50, category: 'Tops' });
    await reviewsRepo.create({ productId: 1, author: 'Alice', rating: 5, comment: 'Great!' });
  });

  it('updates rating and comment', async () => {
    const r = await reviewsRepo.update(1, { rating: 2, comment: 'Changed mind.' });
    expect(r.rating).toBe(2);
    expect(r.comment).toBe('Changed mind.');
    expect(r.author).toBe('Alice'); // unchanged
  });

  it('returns null for unknown id', async () => {
    expect(await reviewsRepo.update(999, { rating: 1, comment: 'X' })).toBeNull();
  });
});

describe('reviewsRepo › delete', () => {
  beforeEach(async () => {
    await repository.create({ name: 'Shirt', price: 50, category: 'Tops' });
    await reviewsRepo.create({ productId: 1, author: 'Alice', rating: 5, comment: 'Great!' });
  });

  it('deletes the review and returns true', async () => {
    expect(await reviewsRepo.delete(1)).toBe(true);
    expect(await reviewsRepo.getById(1)).toBeNull();
  });

  it('returns false for unknown id', async () => {
    expect(await reviewsRepo.delete(999)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  REVIEW STATISTICS
// ─────────────────────────────────────────────────────────────
describe('reviewsRepo › statsForProduct', () => {
  beforeEach(async () => {
    await repository.create({ name: 'Shirt', price: 50, category: 'Tops' });
  });

  it('returns zeros when no reviews', async () => {
    const s = await reviewsRepo.statsForProduct(1);
    expect(s.count).toBe(0);
    expect(s.avgRating).toBe(0);
    expect(s.distribution).toEqual([]);
  });

  it('computes average and distribution correctly', async () => {
    for (const rating of [5, 5, 4, 3, 1]) {
      await reviewsRepo.create({ productId: 1, author: 'T', rating, comment: 'Comment text here.' });
    }
    const s = await reviewsRepo.statsForProduct(1);
    expect(s.count).toBe(5);
    expect(s.avgRating).toBeCloseTo(3.6, 1);
    const star5 = s.distribution.find((d) => d.star === 5);
    expect(star5.count).toBe(2);
    const star2 = s.distribution.find((d) => d.star === 2);
    expect(star2.count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  CASCADE DELETE (DB-level FK)
// ─────────────────────────────────────────────────────────────
describe('cascade delete (product → reviews)', () => {
  it('removes all reviews when the product is deleted', async () => {
    await repository.create({ name: 'Shirt', price: 50, category: 'Tops' });
    await reviewsRepo.create({ productId: 1, author: 'A', rating: 5, comment: 'Lovely!' });
    await reviewsRepo.create({ productId: 1, author: 'B', rating: 3, comment: 'Decent.' });

    expect(await reviewsRepo.getAll()).toHaveLength(2);
    await repository.delete(1);
    expect(await reviewsRepo.getAll()).toHaveLength(0);
  });

  it('only removes reviews for the deleted product', async () => {
    await repository.create({ name: 'P1', price: 50, category: 'Tops' });
    await repository.create({ name: 'P2', price: 60, category: 'Tops' });
    await reviewsRepo.create({ productId: 1, author: 'A', rating: 5, comment: 'Great!' });
    await reviewsRepo.create({ productId: 2, author: 'B', rating: 4, comment: 'Good.' });

    await repository.delete(1);
    const remaining = await reviewsRepo.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].productId).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
//  SEQUENCE RESET
// ─────────────────────────────────────────────────────────────
describe('sequence reset after clear()', () => {
  it('IDs restart from 1 after each clear', async () => {
    await repository.create({ name: 'First', price: 10, category: 'Tops' });
    await repository.create({ name: 'Second', price: 20, category: 'Tops' });

    await repository.clear();

    const p = await repository.create({ name: 'Fresh', price: 30, category: 'Tops' });
    expect(p.id).toBe(1);
  });
});
