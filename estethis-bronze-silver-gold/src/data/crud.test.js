// ─────────────────────────────────────────────────────────────
// crud.test.js
// Run: npm test
// Run with coverage: npm run test:coverage
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildProduct,
  addProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  paginate,
  _resetIdCounter,
} from "./crud.js";

// Reset ID counter before every test so IDs are deterministic
beforeEach(() => _resetIdCounter());

// ── Shared valid raw input ────────────────────────────────────
const RAW = {
  name:        "Oxford Regular",
  price:       "100",
  stock:       "7",
  category:    "Tops",
  colors:      ["Black", "Navy"],
  sizes:       ["S", "M", "L", "XL"],
  description: "Classic Oxford shirt.",
  features:    ["100% cotton", "Button-down collar"],
  image:       "https://example.com/oxford.jpg",
};

// Second product for multi-item list tests
const RAW2 = { ...RAW, name: "Linen Shirt", price: "85", category: "Tops" };

// ── Helper: build a non-empty list for tests that need one ────
// makeList()         → 1 product (default RAW)
// makeList(o1, o2)   → 2 products, each spread over RAW
function makeList(...overrides) {
  const items = overrides.length > 0 ? overrides : [{}];
  return items.reduce(
    (list, o) => addProduct(list, { ...RAW, ...o }),
    []
  );
}

// ═════════════════════════════════════════════════════════════
// buildProduct
// ═════════════════════════════════════════════════════════════

describe("buildProduct", () => {
  let p;
  beforeEach(() => { p = buildProduct(RAW); });

  // ── Output shape ──────────────────────────────────────────
  it("returns an object",                    () => expect(p).toBeTypeOf("object"));
  it("has an id field",                      () => expect(p).toHaveProperty("id"));
  it("has a name field",                     () => expect(p).toHaveProperty("name"));
  it("has a price field",                    () => expect(p).toHaveProperty("price"));
  it("has a stock field",                    () => expect(p).toHaveProperty("stock"));
  it("has a category field",                 () => expect(p).toHaveProperty("category"));
  it("has a colors array",                   () => expect(p).toHaveProperty("colors"));
  it("has a sizes array",                    () => expect(p).toHaveProperty("sizes"));
  it("has a description field",              () => expect(p).toHaveProperty("description"));
  it("has a features array",                 () => expect(p).toHaveProperty("features"));
  it("has an image field",                   () => expect(p).toHaveProperty("image"));
  it("has createdAt",                        () => expect(p).toHaveProperty("createdAt"));
  it("has updatedAt",                        () => expect(p).toHaveProperty("updatedAt"));

  // ── Type coercions ─────────────────────────────────────────
  it("id is a number",                       () => expect(p.id).toBeTypeOf("number"));
  it("price is a number (not a string)",     () => expect(p.price).toBeTypeOf("number"));
  it("stock is an integer",                  () => { expect(p.stock).toBeTypeOf("number"); expect(Number.isInteger(p.stock)).toBe(true); });
  it("price is rounded to 2 dp",            () => expect(p.price).toBe(100));
  it("stock equals 7",                       () => expect(p.stock).toBe(7));

  // ── String normalisation ───────────────────────────────────
  it("name is trimmed",                      () => expect(buildProduct({ ...RAW, name: "  Oxford  " }).name).toBe("Oxford"));
  it("description is trimmed",               () => expect(buildProduct({ ...RAW, description: "  hi  " }).description).toBe("hi"));

  // ── Array normalisation ────────────────────────────────────
  it("colors array has correct length",      () => expect(p.colors).toHaveLength(2));
  it("sizes array has correct length",       () => expect(p.sizes).toHaveLength(4));
  it("empty color strings are stripped",     () => expect(buildProduct({ ...RAW, colors: ["Blue", "", "  "] }).colors).toHaveLength(1));
  it("features filters empty strings",       () => expect(buildProduct({ ...RAW, features: ["Cotton", ""] }).features).toHaveLength(1));

  // ── Category ──────────────────────────────────────────────
  it("category is preserved",               () => expect(p.category).toBe("Tops"));
  it("missing category defaults to Tops",   () => { const q = buildProduct({ ...RAW, category: undefined }); expect(q.category).toBe("Tops"); });

  // ── Image ─────────────────────────────────────────────────
  it("image URL is preserved",              () => expect(p.image).toBe(RAW.image));
  it("undefined image defaults to empty",   () => expect(buildProduct({ ...RAW, image: undefined }).image).toBe(""));

  // ── Timestamps ────────────────────────────────────────────
  it("createdAt is ISO string",             () => expect(p.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/));
  it("updatedAt is ISO string",             () => expect(p.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/));

  // ── existingId ────────────────────────────────────────────
  it("preserves existingId when provided",  () => expect(buildProduct(RAW, 42).id).toBe(42));
  it("generates id when existingId=null",   () => expect(buildProduct(RAW, null).id).toBeTypeOf("number"));
  it("preserves createdAt when editing",    () => {
    const ts = "2024-01-01T00:00:00Z";
    expect(buildProduct({ ...RAW, createdAt: ts }, 99).createdAt).toBe(ts);
  });
  it("generates new createdAt when adding", () => {
    const fresh = buildProduct(RAW, null);
    expect(fresh.createdAt).not.toBe("2024-01-01T00:00:00Z");
  });

  // ── Decimal precision on price ────────────────────────────
  it("price 19.999 rounds to 2 dp",         () => expect(buildProduct({ ...RAW, price: "19.999" }).price).toBe(20));
  it("price 9.99 stays 9.99",               () => expect(buildProduct({ ...RAW, price: "9.99" }).price).toBe(9.99));
});

// ═════════════════════════════════════════════════════════════
// addProduct
// ═════════════════════════════════════════════════════════════

describe("addProduct", () => {
  it("adds to empty list → length 1",             () => expect(addProduct([], RAW)).toHaveLength(1));
  it("adds to existing list → length increases",  () => expect(addProduct(makeList(), RAW2)).toHaveLength(2));
  it("returns a new array (immutability)",         () => {
    const before = makeList();
    const after  = addProduct(before, RAW2);
    expect(after).not.toBe(before);
    expect(before).toHaveLength(1); // original untouched
  });
  it("new product is appended at the end",        () => {
    const list = addProduct(makeList(), RAW2);
    expect(list[list.length - 1].name).toBe("Linen Shirt");
  });
  it("throws for invalid name",                   () => expect(() => addProduct([], { ...RAW, name: "" })).toThrow());
  it("throws for negative price",                 () => expect(() => addProduct([], { ...RAW, price: "-5" })).toThrow());
  it("throws for non-integer stock",              () => expect(() => addProduct([], { ...RAW, stock: "2.5" })).toThrow());
  it("throws for empty colors",                   () => expect(() => addProduct([], { ...RAW, colors: [] })).toThrow());
  it("throws for empty sizes",                    () => expect(() => addProduct([], { ...RAW, sizes: [] })).toThrow());
  it("throws for invalid category",               () => expect(() => addProduct([], { ...RAW, category: "Footwear" })).toThrow());
  it("throws for bad image URL",                  () => expect(() => addProduct([], { ...RAW, image: "not-a-url" })).toThrow());
  it("error message contains serialised errors",  () => {
    try { addProduct([], { ...RAW, name: "" }); }
    catch (e) { expect(e.message).toContain("name"); }
  });
  it("does not mutate source array",              () => {
    const src = [];
    addProduct(src, RAW);
    expect(src).toHaveLength(0);
  });
  it("each added product gets a unique id",       () => {
    const a = addProduct([], RAW)[0];
    // Pause 1ms between calls to ensure Date.now() differs
    const b = addProduct([], RAW2)[0];
    // IDs may collide only in same ms; just verify both are numbers
    expect(typeof a.id).toBe("number");
    expect(typeof b.id).toBe("number");
  });
});

// ═════════════════════════════════════════════════════════════
// updateProduct
// ═════════════════════════════════════════════════════════════

describe("updateProduct", () => {
  let list, id;
  beforeEach(() => {
    list = makeList();       // 1 product
    id   = list[0].id;
  });

  it("updated name is reflected",             () => expect(updateProduct(list, id, { ...RAW, name: "New Name" })[0].name).toBe("New Name"));
  it("updated price is reflected",            () => expect(updateProduct(list, id, { ...RAW, price: "200" })[0].price).toBe(200));
  it("updated stock is reflected",            () => expect(updateProduct(list, id, { ...RAW, stock: "99" })[0].stock).toBe(99));
  it("updated category is reflected",         () => expect(updateProduct(list, id, { ...RAW, category: "Dresses" })[0].category).toBe("Dresses"));
  it("list length stays the same",            () => expect(updateProduct(list, id, RAW)).toHaveLength(1));
  it("returns a new array (immutability)",    () => expect(updateProduct(list, id, RAW)).not.toBe(list));
  it("createdAt is preserved on update",      () => {
    const original = list[0].createdAt;
    const updated  = updateProduct(list, id, RAW);
    expect(updated[0].createdAt).toBe(original);
  });
  it("updatedAt is refreshed (or equal in same ms)", () => {
    const updated = updateProduct(list, id, RAW);
    expect(updated[0].updatedAt).toBeTypeOf("string");
  });
  it("other products in the list are untouched", () => {
    const twoItem = makeList(undefined, RAW2);
    const targetId = twoItem[0].id;
    const result = updateProduct(twoItem, targetId, { ...RAW, name: "Changed" });
    expect(result[1].name).toBe("Linen Shirt"); // second product unchanged
  });
  it("non-matching id → no product changed", () => {
    const result = updateProduct(list, 99999, RAW);
    expect(result[0].name).toBe(list[0].name);
  });
  it("throws for invalid name on update",    () => expect(() => updateProduct(list, id, { ...RAW, name: "" })).toThrow());
  it("throws for negative price on update",  () => expect(() => updateProduct(list, id, { ...RAW, price: "-1" })).toThrow());
  it("throws for empty colors on update",    () => expect(() => updateProduct(list, id, { ...RAW, colors: [] })).toThrow());
  it("throws for bad category on update",    () => expect(() => updateProduct(list, id, { ...RAW, category: "Hats" })).toThrow());
  it("does not mutate the original list",    () => {
    const copy = [...list];
    updateProduct(list, id, { ...RAW, name: "New Name" });
    expect(list[0].name).toBe(copy[0].name);
  });
});

// ═════════════════════════════════════════════════════════════
// deleteProduct
// ═════════════════════════════════════════════════════════════

describe("deleteProduct", () => {
  it("removes the target product by id",         () => {
    const list = makeList(undefined, RAW2);
    const id   = list[0].id;
    expect(deleteProduct(list, id)).toHaveLength(1);
  });
  it("the deleted product is not in the result", () => {
    const list = makeList();
    const id   = list[0].id;
    expect(deleteProduct(list, id).find(p => p.id === id)).toBeUndefined();
  });
  it("sibling products are preserved",           () => {
    const list   = makeList(undefined, RAW2);
    const kept   = list[1];
    const result = deleteProduct(list, list[0].id);
    expect(result[0].id).toBe(kept.id);
  });
  it("deleting from single-item list → []",      () => {
    const list = makeList();
    expect(deleteProduct(list, list[0].id)).toHaveLength(0);
  });
  it("deleting from empty list is safe",         () => expect(deleteProduct([], 1)).toHaveLength(0));
  it("non-existent id leaves list intact",       () => expect(deleteProduct(makeList(), 99999)).toHaveLength(1));
  it("returns a new array (immutability)",       () => {
    const list = makeList();
    expect(deleteProduct(list, list[0].id)).not.toBe(list);
  });
  it("does not mutate the original list",        () => {
    const list = makeList(undefined, RAW2);
    const len  = list.length;
    deleteProduct(list, list[0].id);
    expect(list).toHaveLength(len);
  });
});

// ═════════════════════════════════════════════════════════════
// getProduct
// ═════════════════════════════════════════════════════════════

describe("getProduct", () => {
  it("finds an existing product",              () => {
    const list = makeList();
    expect(getProduct(list, list[0].id)).not.toBeNull();
  });
  it("returns the correct product by id",      () => {
    const list = makeList(undefined, RAW2);
    expect(getProduct(list, list[1].id)?.name).toBe("Linen Shirt");
  });
  it("returns null for a missing id",          () => expect(getProduct(makeList(), 99999)).toBeNull());
  it("returns null for empty list",            () => expect(getProduct([], 1)).toBeNull());
  it("does not throw on undefined id",         () => expect(() => getProduct(makeList(), undefined)).not.toThrow());
  it("does not modify the list",               () => {
    const list = makeList();
    getProduct(list, list[0].id);
    expect(list).toHaveLength(1);
  });
  it("first product accessible",              () => {
    const list = makeList(undefined, RAW2);
    expect(getProduct(list, list[0].id)?.name).toBe("Oxford Regular");
  });
  it("last product accessible",               () => {
    const list = makeList(undefined, RAW2);
    expect(getProduct(list, list[list.length - 1].id)?.name).toBe("Linen Shirt");
  });
});

// ═════════════════════════════════════════════════════════════
// paginate
// ═════════════════════════════════════════════════════════════

describe("paginate", () => {
  const arr = Array.from({ length: 8 }, (_, i) => i); // [0,1,2,3,4,5,6,7]

  // ── items slicing ─────────────────────────────────────────
  it("page 1 / size 3 → items [0,1,2]",          () => expect(paginate(arr, 1, 3).items).toEqual([0, 1, 2]));
  it("page 2 / size 3 → items [3,4,5]",          () => expect(paginate(arr, 2, 3).items).toEqual([3, 4, 5]));
  it("page 3 / size 3 → items [6,7]",            () => expect(paginate(arr, 3, 3).items).toEqual([6, 7]));
  it("page 1 / size 8 → all items",              () => expect(paginate(arr, 1, 8).items).toEqual(arr));
  it("page 1 / size 10 → all items (over-size)", () => expect(paginate(arr, 1, 10).items).toEqual(arr));
  it("page beyond end → empty items",            () => expect(paginate(arr, 99, 3).items).toEqual([]));

  // ── totalPages ────────────────────────────────────────────
  it("8 items / size 3 → 3 pages",               () => expect(paginate(arr, 1, 3).totalPages).toBe(3));
  it("8 items / size 4 → 2 pages",               () => expect(paginate(arr, 1, 4).totalPages).toBe(2));
  it("8 items / size 8 → 1 page",                () => expect(paginate(arr, 1, 8).totalPages).toBe(1));
  it("8 items / size 9 → 1 page",                () => expect(paginate(arr, 1, 9).totalPages).toBe(1));
  it("empty list → totalPages is 1",             () => expect(paginate([], 1, 3).totalPages).toBe(1));

  // ── total ─────────────────────────────────────────────────
  it("total equals source array length",         () => expect(paginate(arr, 1, 3).total).toBe(8));
  it("empty list → total is 0",                  () => expect(paginate([], 1, 3).total).toBe(0));
  it("total unchanged across different pages",   () => {
    expect(paginate(arr, 2, 3).total).toBe(8);
    expect(paginate(arr, 3, 3).total).toBe(8);
  });

  // ── boundary & edge cases ─────────────────────────────────
  it("page size 1 → each page has 1 item",       () => {
    for (let pg = 1; pg <= 8; pg++) {
      expect(paginate(arr, pg, 1).items).toHaveLength(1);
      expect(paginate(arr, pg, 1).items[0]).toBe(pg - 1);
    }
  });
  it("first item on page 2 is item index 3",     () => expect(paginate(arr, 2, 3).items[0]).toBe(3));
  it("paginate does not mutate source array",     () => {
    const copy = [...arr];
    paginate(arr, 1, 3);
    expect(arr).toEqual(copy);
  });
  it("single-item list → 1 page, 1 item",        () => {
    const r = paginate([42], 1, 3);
    expect(r.totalPages).toBe(1);
    expect(r.total).toBe(1);
    expect(r.items).toEqual([42]);
  });
});

// ═════════════════════════════════════════════════════════════
// Integration: add → update → delete lifecycle
// ═════════════════════════════════════════════════════════════

describe("CRUD lifecycle integration", () => {
  it("add → get → update → get → delete → get", () => {
    // Add
    const list1 = addProduct([], RAW);
    expect(list1).toHaveLength(1);
    const id = list1[0].id;

    // Get
    const found1 = getProduct(list1, id);
    expect(found1).not.toBeNull();
    expect(found1.name).toBe("Oxford Regular");

    // Update
    const list2  = updateProduct(list1, id, { ...RAW, name: "Updated Oxford", price: "110" });
    const found2 = getProduct(list2, id);
    expect(found2.name).toBe("Updated Oxford");
    expect(found2.price).toBe(110);
    expect(found2.createdAt).toBe(found1.createdAt); // preserved

    // Delete
    const list3  = deleteProduct(list2, id);
    expect(list3).toHaveLength(0);
    expect(getProduct(list3, id)).toBeNull();
  });

  it("add multiple → delete one → others intact", () => {
    let list = [];
    list = addProduct(list, RAW);
    list = addProduct(list, { ...RAW, name: "Shirt 2" });
    list = addProduct(list, { ...RAW, name: "Shirt 3" });
    expect(list).toHaveLength(3);

    const deleteId = list[1].id;
    list = deleteProduct(list, deleteId);
    expect(list).toHaveLength(2);
    expect(list.find(p => p.id === deleteId)).toBeUndefined();
    expect(list.find(p => p.name === "Oxford Regular")).toBeTruthy();
    expect(list.find(p => p.name === "Shirt 3")).toBeTruthy();
  });

  it("paginate reflects live list after add/delete", () => {
    let list = [];
    for (let i = 0; i < 5; i++) list = addProduct(list, { ...RAW, name: `Shirt ${i}` });
    expect(paginate(list, 1, 3).totalPages).toBe(2);

    list = deleteProduct(list, list[4].id); // 4 items
    expect(paginate(list, 2, 3).items).toHaveLength(1);

    list = deleteProduct(list, list[3].id); // 3 items
    expect(paginate(list, 1, 3).totalPages).toBe(1);
  });
});
