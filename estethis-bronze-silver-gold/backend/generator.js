// ─────────────────────────────────────────────────────────────
// GENERATOR (Silver) — async Faker-based product inserter
// tickOnce() is async because repository.create() hits the DB.
// ─────────────────────────────────────────────────────────────

import { faker }       from '@faker-js/faker';
import repository      from './repository.js';
import { events, EVENTS } from './events.js';

const CATEGORIES   = ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Accessories'];
const SIZES        = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLOR_POOL   = [
  'Black', 'White', 'Navy', 'Cream', 'Beige', 'Charcoal',
  'Burgundy', 'Sage', 'Camel', 'Olive', 'Stone', 'Ivory',
  'Forest Green', 'Rust', 'Midnight',
];
const FEATURE_POOL = [
  'Pre-shrunk cotton',
  'Stretch cotton blend',
  'Mother-of-pearl buttons',
  'Roll-up sleeve tabs',
  'Reinforced stitching',
  'Anti-pilling treatment',
  'Breathable weave',
  'Single-button cuffs',
  'Full canvas construction',
];

const MIN_INTERVAL = 250;
const MAX_BATCH    = 20;

export function fakeProduct() {
  const name = `${faker.commerce.productAdjective()} ${faker.commerce.product()}`.slice(0, 60);
  return {
    name,
    category:    faker.helpers.arrayElement(CATEGORIES),
    price:       Number(faker.commerce.price({ min: 25, max: 999, dec: 2 })),
    stock:       faker.number.int({ min: 0, max: 80 }),
    colors:      faker.helpers.arrayElements(COLOR_POOL,   { min: 1, max: 4 }),
    sizes:       faker.helpers.arrayElements(SIZES,        { min: 1, max: 4 }),
    description: faker.commerce.productDescription().slice(0, 300),
    features:    faker.helpers.arrayElements(FEATURE_POOL, { min: 2, max: 5 }),
    image:       `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/400/400`,
  };
}

let timer          = null;
let intervalMs     = 2000;
let batchSize      = 3;
let totalGenerated = 0;
let startedAt      = null;

function isRunning() { return timer !== null; }

export function status() {
  return { running: isRunning(), intervalMs, batchSize, totalGenerated, startedAt };
}

export async function tickOnce(n = batchSize) {
  const created = [];
  for (let i = 0; i < n; i++) {
    created.push(await repository.create(fakeProduct()));
  }
  totalGenerated += created.length;
  if (created.length > 0) events.emit(EVENTS.PRODUCT_BATCH, created);
  return created;
}

export function start({ intervalMs: i, batchSize: b } = {}) {
  if (i !== undefined) {
    const n = Number(i);
    if (!Number.isFinite(n) || n < MIN_INTERVAL)
      throw new Error(`intervalMs must be a number >= ${MIN_INTERVAL}.`);
    intervalMs = n;
  }
  if (b !== undefined) {
    const n = Number(b);
    if (!Number.isFinite(n) || n < 1 || n > MAX_BATCH)
      throw new Error(`batchSize must be 1..${MAX_BATCH}.`);
    batchSize = n;
  }

  if (timer) return status();

  startedAt = new Date().toISOString();
  timer = setInterval(async () => {
    try { await tickOnce(batchSize); }
    catch (err) { console.error('[generator] tick error:', err); }
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  events.emit(EVENTS.GENERATOR_STATE, status());
  return status();
}

export function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  startedAt = null;
  events.emit(EVENTS.GENERATOR_STATE, status());
  return status();
}

export function reset() {
  stop();
  totalGenerated = 0;
  intervalMs = 2000;
  batchSize  = 3;
}
