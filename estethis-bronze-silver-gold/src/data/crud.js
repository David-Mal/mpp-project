// ─────────────────────────────────────────────────────────────
// CRUD OPERATIONS
// Pure functions that operate on the products array.
// They never mutate state directly — they return new arrays.
// The React components call these and pass the result to
// setProducts(), keeping state immutable.
// ─────────────────────────────────────────────────────────────

import { validateProduct } from "./validators";

// Monotonic counter for unique IDs — avoids Date.now() collisions
// in fast test suites where multiple products are built in the same ms.
let _idCounter = 1;
export function _resetIdCounter() { _idCounter = 1; }   // exposed for tests only

/**
 * Constructs a clean product object from raw form data.
 * @param {object} data - raw form values
 * @param {number|null} existingId - if editing, pass the existing id
 * @returns {object} product
 */
export function buildProduct(data, existingId = null) {
  return {
    id:          existingId ?? _idCounter++,
    name:        data.name.trim(),
    category:    data.category || "Tops",
    price:       parseFloat(parseFloat(data.price).toFixed(2)),
    stock:       parseInt(data.stock, 10),
    colors:      (data.colors  || []).map((c) => c.trim()).filter(Boolean),
    sizes:       (data.sizes   || []).map((s) => s.trim()).filter(Boolean),
    description: (data.description || "").trim(),
    features:    Array.isArray(data.features)
                   ? data.features.filter((f) => f.trim())
                   : [],
    image:       data.image || "",
    createdAt:   existingId ? data.createdAt : new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
}

/**
 * Adds a new product to the list.
 * Throws if validation fails.
 * @param {object[]} products
 * @param {object} data - raw form values
 * @returns {object[]} new array with the product appended
 */
export function addProduct(products, data) {
  const { valid, errors } = validateProduct(data);
  if (!valid) throw new Error(JSON.stringify(errors));
  return [...products, buildProduct(data)];
}

/**
 * Updates an existing product by id.
 * Throws if validation fails.
 * @param {object[]} products
 * @param {number} id
 * @param {object} data - raw form values
 * @returns {object[]} new array with the product replaced
 */
export function updateProduct(products, id, data) {
  const { valid, errors } = validateProduct(data);
  if (!valid) throw new Error(JSON.stringify(errors));
  return products.map((p) =>
    p.id === id
      ? buildProduct({ ...data, createdAt: p.createdAt }, id)
      : p
  );
}

/**
 * Removes a product by id.
 * @param {object[]} products
 * @param {number} id
 * @returns {object[]} new array without the product
 */
export function deleteProduct(products, id) {
  return products.filter((p) => p.id !== id);
}

/**
 * Finds a single product by id.
 * @param {object[]} products
 * @param {number} id
 * @returns {object|null}
 */
export function getProduct(products, id) {
  return products.find((p) => p.id === id) ?? null;
}

/**
 * Returns a page slice of an array plus pagination metadata.
 * @param {any[]} items
 * @param {number} page - 1-based
 * @param {number} pageSize
 * @returns {{ items: any[], totalPages: number, total: number }}
 */
export function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return {
    items:      items.slice(start, start + pageSize),
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    total:      items.length,
  };
}
