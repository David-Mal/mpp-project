// ─────────────────────────────────────────────────────────────
// tests.js — Legacy browser console runner
//
// ⚠  The canonical test suite is now in:
//      src/data/validators.test.js  (100+ assertions)
//      src/data/crud.test.js        (90+ assertions)
//
// Run the real suite with:
//   npm test                  → single run
//   npm run test:coverage     → with V8 coverage report
//   npm run test:watch        → watch mode
//
// This file is kept so window.__runTests() still works
// in the browser for quick smoke-checks during development.
// ─────────────────────────────────────────────────────────────

import { validateProduct, validateField } from "./validators.js";
import { buildProduct, addProduct, updateProduct, deleteProduct, getProduct, paginate } from "./crud.js";

function runTests() {
  let passed = 0, failed = 0;

  const assert = (label, condition) => {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else           { console.error(`  ❌ ${label}`); failed++; }
  };

  const valid = {
    name: "Test Shirt", price: "75", stock: "5",
    category: "Tops",
    colors: ["Blue", "White"], sizes: ["S", "M"],
    description: "A shirt.", features: ["Cotton"],
    image: "https://example.com/shirt.jpg",
  };

  console.group("Estethis — Browser Smoke Tests (run npm test for full suite)");

  // ── validateProduct ───────────────────────────────────────
  console.group("validateProduct");
  assert("valid product passes",          validateProduct(valid).valid);
  assert("empty name fails",              !validateProduct({ ...valid, name: "" }).valid);
  assert("negative price fails",          !validateProduct({ ...valid, price: "-1" }).valid);
  assert("float stock fails",             !validateProduct({ ...valid, stock: "2.5" }).valid);
  assert("empty colors fails",            !validateProduct({ ...valid, colors: [] }).valid);
  assert("empty sizes fails",             !validateProduct({ ...valid, sizes: [] }).valid);
  assert("bad category fails",            !validateProduct({ ...valid, category: "Footwear" }).valid);
  assert("bad image URL fails",           !validateProduct({ ...valid, image: "not-a-url" }).valid);
  assert("3 decimal places price fails",  !validateProduct({ ...valid, price: "9.999" }).valid);
  assert("numeric-only color fails",      !validateProduct({ ...valid, colors: ["123"] }).valid);
  assert("over 20 colors fails",          !validateProduct({ ...valid, colors: Array(21).fill("Red") }).valid);
  assert("feature over 200 chars fails",  !validateProduct({ ...valid, features: ["x".repeat(201)] }).valid);
  console.groupEnd();

  // ── validateField ─────────────────────────────────────────
  console.group("validateField");
  assert("valid name field → undefined",   validateField("name",  valid) === undefined);
  assert("invalid name field → string",    typeof validateField("name", { ...valid, name: "" }) === "string");
  assert("valid price field → undefined",  validateField("price", valid) === undefined);
  console.groupEnd();

  // ── buildProduct ──────────────────────────────────────────
  console.group("buildProduct");
  const built = buildProduct(valid);
  assert("price coerced to number",   typeof built.price === "number");
  assert("stock coerced to integer",  Number.isInteger(built.stock));
  assert("existingId preserved",      buildProduct(valid, 42).id === 42);
  assert("category preserved",        built.category === "Tops");
  console.groupEnd();

  // ── addProduct ────────────────────────────────────────────
  console.group("addProduct");
  const list1 = addProduct([], valid);
  assert("adds to empty list",        list1.length === 1);
  assert("throws on invalid data",    (() => { try { addProduct([], { ...valid, name: "" }); return false; } catch { return true; } })());
  assert("immutable — original empty", (() => { const s = []; addProduct(s, valid); return s.length === 0; })());
  console.groupEnd();

  // ── updateProduct ─────────────────────────────────────────
  console.group("updateProduct");
  const id      = list1[0].id;
  const updated = updateProduct(list1, id, { ...valid, name: "Updated" });
  assert("name updated",              updated[0].name === "Updated");
  assert("createdAt preserved",       updated[0].createdAt === list1[0].createdAt);
  assert("throws on invalid data",    (() => { try { updateProduct(list1, id, { ...valid, price: "-5" }); return false; } catch { return true; } })());
  console.groupEnd();

  // ── deleteProduct ─────────────────────────────────────────
  console.group("deleteProduct");
  const after = deleteProduct(list1, id);
  assert("removes product",           after.length === 0);
  assert("nonexistent id is safe",    deleteProduct(list1, 99999).length === 1);
  console.groupEnd();

  // ── getProduct ────────────────────────────────────────────
  console.group("getProduct");
  assert("finds by id",               getProduct(list1, id) !== null);
  assert("returns null for missing",   getProduct(list1, 99999) === null);
  assert("returns null on empty list", getProduct([], 1) === null);
  console.groupEnd();

  // ── paginate ──────────────────────────────────────────────
  console.group("paginate");
  const arr = [0,1,2,3,4,5,6,7];
  assert("page 1 has 3 items",        paginate(arr, 1, 3).items.length === 3);
  assert("page 3 has 2 items",        paginate(arr, 3, 3).items.length === 2);
  assert("totalPages = 3",            paginate(arr, 1, 3).totalPages === 3);
  assert("empty list totalPages = 1", paginate([], 1, 3).totalPages === 1);
  console.groupEnd();

  console.log(`\nSmoke test results: ${passed} passed · ${failed} failed`);
  console.info("→ For full suite + coverage: npm run test:coverage");
  console.groupEnd();
}

if (typeof window !== "undefined") {
  window.__runTests = runTests;
  console.info("Estethis: run window.__runTests() for quick smoke tests. Full suite: npm test");
}
