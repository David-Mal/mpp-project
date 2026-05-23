// ─────────────────────────────────────────────────────────────
// GOLD BACKEND TESTS
// Covers: Reviews REST (1-to-many CRUD + stats),
//         GraphQL queries/mutations, cascade delete.
// All repository calls are async (SQLite-backed).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import request    from 'supertest';
import app        from './app.js';
import repository from './repository.js';
import reviewsRepo from './reviewsRepo.js';

const PRODUCT = { name: 'Test Shirt', price: 99, category: 'Tops', stock: 5, colors: ['White'], sizes: ['M'] };
const REVIEW  = { author: 'Alice R.', rating: 5, comment: 'Absolutely love this shirt!' };

beforeEach(async () => {
  await repository.clear();
  await reviewsRepo.clear();
});

async function gql(query, variables = {}) {
  return request(app)
    .post('/graphql')
    .set('Content-Type', 'application/json')
    .send({ query, variables });
}

// ─────────────────────────────────────────────────────────────
//  REVIEWS REST (1-to-many)
// ─────────────────────────────────────────────────────────────
describe('Reviews REST — /api/products/:id/reviews', () => {
  let productId;
  beforeEach(async () => {
    const res = await request(app).post('/api/products').send(PRODUCT);
    productId = res.body.id;
  });

  it('POST creates a review (201)', async () => {
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .send(REVIEW);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ productId, author: 'Alice R.', rating: 5 });
    expect(res.body.id).toBeTruthy();
  });

  it('GET lists reviews with pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await request(app).post(`/api/products/${productId}/reviews`)
        .send({ author: `User ${i}`, rating: i, comment: `Comment number ${i} here.` });
    }
    const res = await request(app).get(`/api/products/${productId}/reviews?page=1&limit=3`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.total).toBe(5);
  });

  it('GET returns 404 for unknown product', async () => {
    const res = await request(app).get('/api/products/9999/reviews');
    expect(res.status).toBe(404);
  });

  it('GET /stats returns avg rating and distribution', async () => {
    for (const rating of [5, 5, 4, 3, 1]) {
      await request(app).post(`/api/products/${productId}/reviews`)
        .send({ author: 'Tester', rating, comment: 'Review comment here.' });
    }
    const res = await request(app).get(`/api/products/${productId}/reviews/stats`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(5);
    expect(res.body.avgRating).toBeCloseTo(3.6, 1);
    expect(res.body.distribution).toHaveLength(5);
    expect(res.body.distribution.find((d) => d.star === 5).count).toBe(2);
  });

  it('PUT /api/reviews/:id updates a review', async () => {
    const r = (await request(app).post(`/api/products/${productId}/reviews`).send(REVIEW)).body;
    const res = await request(app).put(`/api/reviews/${r.id}`)
      .send({ author: 'Alice R.', rating: 3, comment: 'Changed my mind about it.' });
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(3);
  });

  it('DELETE /api/reviews/:id removes a review (204)', async () => {
    const r = (await request(app).post(`/api/products/${productId}/reviews`).send(REVIEW)).body;
    const del = await request(app).delete(`/api/reviews/${r.id}`);
    expect(del.status).toBe(204);
    const list = await request(app).get(`/api/products/${productId}/reviews`);
    expect(list.body.data).toHaveLength(0);
  });

  it('POST validates review input (400)', async () => {
    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .send({ author: 'X', rating: 9, comment: 'Hi' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('cascade delete removes reviews when product is deleted', async () => {
    await request(app).post(`/api/products/${productId}/reviews`).send(REVIEW);
    await request(app).post(`/api/products/${productId}/reviews`).send({ ...REVIEW, author: 'Bob T.' });
    expect(await reviewsRepo.getAll()).toHaveLength(2);

    await request(app).delete(`/api/products/${productId}`);
    expect(await reviewsRepo.getAll()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  GRAPHQL — Products
// ─────────────────────────────────────────────────────────────
describe('GraphQL — products', () => {
  it('query products returns paginated list', async () => {
    await repository.seed([
      { name: 'Shirt A', category: 'Tops',    price: 50, stock: 5, colors: ['White'], sizes: ['M'] },
      { name: 'Shirt B', category: 'Tops',    price: 80, stock: 3, colors: ['Blue'],  sizes: ['L'] },
      { name: 'Trouser', category: 'Bottoms', price: 90, stock: 8, colors: ['Black'], sizes: ['M'] },
    ]);
    const res = await gql(`query { products(page: 1, limit: 2) {
      data { id name price }
      total page limit totalPages hasMore
    }}`);
    expect(res.status).toBe(200);
    expect(res.body.data.products.data).toHaveLength(2);
    expect(res.body.data.products.total).toBe(3);
    expect(res.body.data.products.hasMore).toBe(true);
  });

  it('query product(id) returns a single product', async () => {
    await repository.seed([{ name: 'Linen Tee', category: 'Tops', price: 75, stock: 4, colors: ['Beige'], sizes: ['S'] }]);
    const res = await gql(`query { product(id: 1) { id name category price } }`);
    expect(res.body.data.product).toMatchObject({ id: 1, name: 'Linen Tee', price: 75 });
  });

  it('query product returns null for missing id', async () => {
    const res = await gql(`query { product(id: 999) { id name } }`);
    expect(res.body.data.product).toBeNull();
  });

  it('products search filters by name', async () => {
    await repository.seed([
      { name: 'Linen Tee',   category: 'Tops', price: 50, stock: 1, colors: ['White'], sizes: ['M'] },
      { name: 'Cotton Polo', category: 'Tops', price: 60, stock: 1, colors: ['Blue'],  sizes: ['M'] },
    ]);
    const res = await gql(`query { products(search: "linen") { data { name } total } }`);
    expect(res.body.data.products.total).toBe(1);
    expect(res.body.data.products.data[0].name).toBe('Linen Tee');
  });

  it('mutation createProduct creates and returns a product', async () => {
    const res = await gql(`
      mutation($input: ProductInput!) {
        createProduct(input: $input) { id name price stock }
      }`, {
      input: { name: 'GraphQL Shirt', category: 'Tops', price: 120, stock: 7, colors: ['Navy'], sizes: ['L'] }
    });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createProduct.name).toBe('GraphQL Shirt');
    expect(res.body.data.createProduct.id).toBeTruthy();
  });

  it('mutation updateProduct updates a product', async () => {
    await repository.seed([{ name: 'Old', category: 'Tops', price: 10, stock: 1, colors: ['White'], sizes: ['M'] }]);
    const res = await gql(`
      mutation($input: ProductInput!) {
        updateProduct(id: 1, input: $input) { id name price }
      }`, {
      input: { name: 'Updated', category: 'Tops', price: 99, stock: 2, colors: ['Black'], sizes: ['S'] }
    });
    expect(res.body.data.updateProduct.name).toBe('Updated');
    expect(res.body.data.updateProduct.price).toBe(99);
  });

  it('mutation deleteProduct removes it', async () => {
    await repository.seed([{ name: 'Del Me', category: 'Tops', price: 10, stock: 1, colors: ['White'], sizes: ['M'] }]);
    const del = await gql(`mutation { deleteProduct(id: 1) }`);
    expect(del.body.data.deleteProduct).toBe(true);
    const check = await gql(`query { product(id: 1) { id } }`);
    expect(check.body.data.product).toBeNull();
  });

  it('productStats returns category breakdown', async () => {
    await repository.seed([
      { name: 'A', category: 'Tops',    price: 100, stock: 5, colors: ['W'], sizes: ['M'] },
      { name: 'B', category: 'Tops',    price: 200, stock: 3, colors: ['W'], sizes: ['M'] },
      { name: 'C', category: 'Bottoms', price: 50,  stock: 2, colors: ['W'], sizes: ['M'] },
    ]);
    const res = await gql(`query { productStats {
      totalProducts totalStock
      byCategory { category count }
    }}`);
    expect(res.body.data.productStats.totalProducts).toBe(3);
    expect(res.body.data.productStats.totalStock).toBe(10);
    const tops = res.body.data.productStats.byCategory.find((c) => c.category === 'Tops');
    expect(tops.count).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
//  GRAPHQL — Reviews (1-to-many)
// ─────────────────────────────────────────────────────────────
describe('GraphQL — reviews (1-to-many)', () => {
  let productId;
  beforeEach(async () => {
    await repository.seed([{ name: 'Shirt', category: 'Tops', price: 50, stock: 5, colors: ['W'], sizes: ['M'] }]);
    productId = 1;
  });

  it('mutation createReview adds a review to a product', async () => {
    const res = await gql(`
      mutation($pid: Int!, $input: ReviewInput!) {
        createReview(productId: $pid, input: $input) {
          id productId author rating comment
        }
      }`, { pid: productId, input: { author: 'Alice R.', rating: 5, comment: 'Amazing quality fabric.' } });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createReview.productId).toBe(productId);
    expect(res.body.data.createReview.rating).toBe(5);
  });

  it('query reviews returns reviews for a product', async () => {
    await reviewsRepo.seed([
      { productId: 1, author: 'A', rating: 5, comment: 'Great product here.' },
      { productId: 1, author: 'B', rating: 3, comment: 'Average product here.' },
    ]);
    const res = await gql(`query($pid: Int!) {
      reviews(productId: $pid) { data { author rating } total }
    }`, { pid: productId });
    expect(res.body.data.reviews.total).toBe(2);
  });

  it('reviewStats returns avgRating and distribution', async () => {
    await reviewsRepo.seed([
      { productId: 1, author: 'A', rating: 5, comment: 'Excellent product overall.' },
      { productId: 1, author: 'B', rating: 5, comment: 'Very good product indeed.' },
      { productId: 1, author: 'C', rating: 3, comment: 'Average product actually.' },
    ]);
    const res = await gql(`query($pid: Int!) {
      reviewStats(productId: $pid) { count avgRating distribution { star count } }
    }`, { pid: productId });
    expect(res.body.data.reviewStats.count).toBe(3);
    expect(res.body.data.reviewStats.avgRating).toBeCloseTo(4.33, 1);
  });

  it('product.reviews field resolver works on nested query', async () => {
    await reviewsRepo.seed([
      { productId: 1, author: 'A', rating: 4, comment: 'Really nice product here.' },
    ]);
    const res = await gql(`query {
      product(id: 1) {
        name
        reviews { data { author rating } total }
        reviewStats { count avgRating }
      }
    }`);
    expect(res.body.data.product.reviews.total).toBe(1);
    expect(res.body.data.product.reviewStats.avgRating).toBe(4);
  });

  it('mutation deleteReview removes a review', async () => {
    await reviewsRepo.seed([{ productId: 1, author: 'A', rating: 4, comment: 'Good product overall.' }]);
    const res = await gql(`mutation { deleteReview(id: 1) }`);
    expect(res.body.data.deleteReview).toBe(true);
    expect(await reviewsRepo.getAll()).toHaveLength(0);
  });

  it('createReview validates input', async () => {
    const res = await gql(`
      mutation($pid: Int!, $input: ReviewInput!) {
        createReview(productId: $pid, input: $input) { id }
      }`, { pid: productId, input: { author: 'X', rating: 10, comment: 'Hi' } });
    expect(res.body.errors).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
//  GRAPHQL — Generator
// ─────────────────────────────────────────────────────────────
describe('GraphQL — generator', () => {
  it('query generatorStatus returns state', async () => {
    const res = await gql(`query { generatorStatus { running intervalMs batchSize } }`);
    expect(res.body.data.generatorStatus.running).toBe(false);
  });

  it('mutation tickGenerator inserts products', async () => {
    const res = await gql(`mutation { tickGenerator(batchSize: 3) { id name } }`);
    expect(res.body.data.tickGenerator).toHaveLength(3);
    expect((await repository.getAll(1, 999)).total).toBe(3);
  });
});
