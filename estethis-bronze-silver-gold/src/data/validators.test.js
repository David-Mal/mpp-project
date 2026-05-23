// ─────────────────────────────────────────────────────────────
// validators.test.js
// Run: npm test
// Run with coverage: npm run test:coverage
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  validateProduct,
  validateField,
  isValidUrl,
  hasMaxDecimals,
  compact,
  ALLOWED_CATEGORIES,
  LIMITS,
} from "./validators.js";

// ── Shared valid baseline (all tests mutate a copy) ───────────
const VALID = {
  name:        "Poplin Regular",
  price:       "75",
  stock:       "5",
  category:    "Tops",
  colors:      ["Blue", "White"],
  sizes:       ["S", "M"],
  description: "A fine shirt.",
  features:    ["100% cotton", "Button-down collar"],
  image:       "https://example.com/shirt.jpg",
};

const v = (overrides = {}) => ({ ...VALID, ...overrides });

// ═════════════════════════════════════════════════════════════
// Helper utilities
// ═════════════════════════════════════════════════════════════

describe("isValidUrl", () => {
  it("returns true for empty string", ()  => expect(isValidUrl("")).toBe(true));
  it("returns true for null",          ()  => expect(isValidUrl(null)).toBe(true));
  it("returns true for https URL",     ()  => expect(isValidUrl("https://img.unsplash.com/photo?w=400")).toBe(true));
  it("returns true for http URL",      ()  => expect(isValidUrl("http://example.com/a.png")).toBe(true));
  it("returns false for bare domain",  ()  => expect(isValidUrl("example.com/img.png")).toBe(false));
  it("returns false for ftp URL",      ()  => expect(isValidUrl("ftp://files.example.com/img")).toBe(false));
  it("returns false for random text",  ()  => expect(isValidUrl("not a url")).toBe(false));
  it("returns false for // protocol",  ()  => expect(isValidUrl("//cdn.example.com/x.jpg")).toBe(false));
  it("trims whitespace before check",  ()  => expect(isValidUrl("  https://ok.com  ")).toBe(true));
});

describe("hasMaxDecimals", () => {
  it("integer → true",             () => expect(hasMaxDecimals("75",    2)).toBe(true));
  it("1 decimal → true",           () => expect(hasMaxDecimals("9.9",   2)).toBe(true));
  it("2 decimals → true",          () => expect(hasMaxDecimals("9.99",  2)).toBe(true));
  it("3 decimals → false",         () => expect(hasMaxDecimals("9.999", 2)).toBe(false));
  it("no decimal point → true",    () => expect(hasMaxDecimals("100",   2)).toBe(true));
  it("trailing dot → true",        () => expect(hasMaxDecimals("10.",   2)).toBe(true));
});

describe("compact", () => {
  it("removes empty strings",          () => expect(compact(["a", "", "b"])).toEqual(["a", "b"]));
  it("removes whitespace-only",        () => expect(compact(["  ", "x"])).toEqual(["x"]));
  it("returns [] for empty array",     () => expect(compact([])).toEqual([]));
  it("returns [] for null",            () => expect(compact(null)).toEqual([]));
  it("returns [] for undefined",       () => expect(compact(undefined)).toEqual([]));
  it("preserves legitimate strings",   () => expect(compact(["Blue", "White"])).toEqual(["Blue", "White"]));
});

// ═════════════════════════════════════════════════════════════
// validateProduct — NAME
// ═════════════════════════════════════════════════════════════

describe("validateProduct › name", () => {
  it("valid name passes",                   () => expect(validateProduct(v()).valid).toBe(true));
  it("empty name fails",                    () => expect(validateProduct(v({ name: "" })).errors.name).toBeTruthy());
  it("whitespace-only name fails",          () => expect(validateProduct(v({ name: "   " })).errors.name).toBeTruthy());
  it("single-char name fails",              () => expect(validateProduct(v({ name: "A" })).errors.name).toBeTruthy());
  it("2-char name passes (min boundary)",   () => expect(validateProduct(v({ name: "AB" })).errors.name).toBeUndefined());
  it("80-char name passes (max boundary)",  () => expect(validateProduct(v({ name: "x".repeat(80) })).errors.name).toBeUndefined());
  it("81-char name fails (over max)",       () => expect(validateProduct(v({ name: "x".repeat(81) })).errors.name).toBeTruthy());
  it("name with numbers passes",            () => expect(validateProduct(v({ name: "Model X1" })).errors.name).toBeUndefined());
  it("undefined name fails",                () => expect(validateProduct(v({ name: undefined })).errors.name).toBeTruthy());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — PRICE
// ═════════════════════════════════════════════════════════════

describe("validateProduct › price", () => {
  it("valid price passes",                        () => expect(validateProduct(v({ price: "75" })).errors.price).toBeUndefined());
  it("empty price fails",                         () => expect(validateProduct(v({ price: "" })).errors.price).toBeTruthy());
  it("null price fails",                          () => expect(validateProduct(v({ price: null })).errors.price).toBeTruthy());
  it("undefined price fails",                     () => expect(validateProduct(v({ price: undefined })).errors.price).toBeTruthy());
  it("non-numeric price fails",                   () => expect(validateProduct(v({ price: "abc" })).errors.price).toBeTruthy());
  it("negative price fails",                      () => expect(validateProduct(v({ price: "-1" })).errors.price).toBeTruthy());
  it("zero price passes",                         () => expect(validateProduct(v({ price: "0" })).errors.price).toBeUndefined());
  it("decimal price passes (2 dp)",               () => expect(validateProduct(v({ price: "19.99" })).errors.price).toBeUndefined());
  it("3 decimal places fails",                    () => expect(validateProduct(v({ price: "9.999" })).errors.price).toBeTruthy());
  it("max price 99999 passes",                    () => expect(validateProduct(v({ price: "99999" })).errors.price).toBeUndefined());
  it("price above 99999 fails",                   () => expect(validateProduct(v({ price: "100000" })).errors.price).toBeTruthy());
  it("string '0.00' passes",                    () => expect(validateProduct(v({ price: "0.00" })).errors.price).toBeUndefined());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — STOCK
// ═════════════════════════════════════════════════════════════

describe("validateProduct › stock", () => {
  it("valid stock passes",             () => expect(validateProduct(v({ stock: "10" })).errors.stock).toBeUndefined());
  it("empty stock fails",              () => expect(validateProduct(v({ stock: "" })).errors.stock).toBeTruthy());
  it("null stock fails",               () => expect(validateProduct(v({ stock: null })).errors.stock).toBeTruthy());
  it("undefined stock fails",          () => expect(validateProduct(v({ stock: undefined })).errors.stock).toBeTruthy());
  it("non-numeric stock fails",        () => expect(validateProduct(v({ stock: "xyz" })).errors.stock).toBeTruthy());
  it("negative stock fails",           () => expect(validateProduct(v({ stock: "-1" })).errors.stock).toBeTruthy());
  it("zero stock passes",              () => expect(validateProduct(v({ stock: "0" })).errors.stock).toBeUndefined());
  it("float stock 2.5 fails",          () => expect(validateProduct(v({ stock: "2.5" })).errors.stock).toBeTruthy());
  it("float stock 2.0 passes",         () => expect(validateProduct(v({ stock: "2.0" })).errors.stock).toBeUndefined());
  it("max stock 99999 passes",         () => expect(validateProduct(v({ stock: "99999" })).errors.stock).toBeUndefined());
  it("stock 100000 fails",             () => expect(validateProduct(v({ stock: "100000" })).errors.stock).toBeTruthy());
  it("large integer passes",           () => expect(validateProduct(v({ stock: "500" })).errors.stock).toBeUndefined());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — CATEGORY
// ═════════════════════════════════════════════════════════════

describe("validateProduct › category", () => {
  it.each(ALLOWED_CATEGORIES)("'%s' passes", (cat) =>
    expect(validateProduct(v({ category: cat })).errors.category).toBeUndefined()
  );
  it("empty category fails",             () => expect(validateProduct(v({ category: "" })).errors.category).toBeTruthy());
  it("undefined category fails",         () => expect(validateProduct(v({ category: undefined })).errors.category).toBeTruthy());
  it("unknown category fails",           () => expect(validateProduct(v({ category: "Footwear" })).errors.category).toBeTruthy());
  it("lowercase category fails",         () => expect(validateProduct(v({ category: "tops" })).errors.category).toBeTruthy());
  it("all-caps category fails",          () => expect(validateProduct(v({ category: "TOPS" })).errors.category).toBeTruthy());
  it("numeric string fails",             () => expect(validateProduct(v({ category: "123" })).errors.category).toBeTruthy());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — COLORS
// ═════════════════════════════════════════════════════════════

describe("validateProduct › colors", () => {
  it("single valid color passes",             () => expect(validateProduct(v({ colors: ["Red"] })).errors.colors).toBeUndefined());
  it("multiple valid colors pass",            () => expect(validateProduct(v({ colors: ["Red", "Blue", "White"] })).errors.colors).toBeUndefined());
  it("empty array fails",                     () => expect(validateProduct(v({ colors: [] })).errors.colors).toBeTruthy());
  it("array of only empty strings fails",     () => expect(validateProduct(v({ colors: ["", "  "] })).errors.colors).toBeTruthy());
  it("color with spaces passes",              () => expect(validateProduct(v({ colors: ["Light Blue"] })).errors.colors).toBeUndefined());
  it("color with hyphen passes",              () => expect(validateProduct(v({ colors: ["Rose-Gold"] })).errors.colors).toBeUndefined());
  it("purely numeric color fails",            () => expect(validateProduct(v({ colors: ["123"] })).errors.colors).toBeTruthy());
  it("color over 30 chars fails",             () => expect(validateProduct(v({ colors: ["x".repeat(31)] })).errors.colors).toBeTruthy());
  it("color exactly 30 chars passes",         () => expect(validateProduct(v({ colors: ["B".repeat(30)] })).errors.colors).toBeUndefined());
  it("exceeding 20 colors fails",             () => expect(validateProduct(v({ colors: Array(21).fill("Red") })).errors.colors).toBeTruthy());
  it("exactly 20 colors passes",              () => expect(validateProduct(v({ colors: Array(20).fill("Red") })).errors.colors).toBeUndefined());
  it("null colors fails",                     () => expect(validateProduct(v({ colors: null })).errors.colors).toBeTruthy());
  it("undefined colors fails",                () => expect(validateProduct(v({ colors: undefined })).errors.colors).toBeTruthy());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — SIZES
// ═════════════════════════════════════════════════════════════

describe("validateProduct › sizes", () => {
  it("single size passes",          () => expect(validateProduct(v({ sizes: ["M"] })).errors.sizes).toBeUndefined());
  it("multiple sizes pass",         () => expect(validateProduct(v({ sizes: ["XS","S","M","L","XL"] })).errors.sizes).toBeUndefined());
  it("empty array fails",           () => expect(validateProduct(v({ sizes: [] })).errors.sizes).toBeTruthy());
  it("null sizes fails",            () => expect(validateProduct(v({ sizes: null })).errors.sizes).toBeTruthy());
  it("undefined sizes fails",       () => expect(validateProduct(v({ sizes: undefined })).errors.sizes).toBeTruthy());
  it("array of whitespace fails",   () => expect(validateProduct(v({ sizes: ["   "] })).errors.sizes).toBeTruthy());
  it("One Size passes",             () => expect(validateProduct(v({ sizes: ["One Size"] })).errors.sizes).toBeUndefined());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — DESCRIPTION
// ═════════════════════════════════════════════════════════════

describe("validateProduct › description", () => {
  it("empty description passes",          () => expect(validateProduct(v({ description: "" })).errors.description).toBeUndefined());
  it("undefined description passes",      () => expect(validateProduct(v({ description: undefined })).errors.description).toBeUndefined());
  it("500-char description passes",       () => expect(validateProduct(v({ description: "x".repeat(500) })).errors.description).toBeUndefined());
  it("501-char description fails",        () => expect(validateProduct(v({ description: "x".repeat(501) })).errors.description).toBeTruthy());
  it("normal sentence passes",            () => expect(validateProduct(v({ description: "A great shirt." })).errors.description).toBeUndefined());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — FEATURES
// ═════════════════════════════════════════════════════════════

describe("validateProduct › features", () => {
  it("empty features array passes",                () => expect(validateProduct(v({ features: [] })).errors.features).toBeUndefined());
  it("undefined features passes",                  () => expect(validateProduct(v({ features: undefined })).errors.features).toBeUndefined());
  it("single valid feature passes",                () => expect(validateProduct(v({ features: ["100% cotton"] })).errors.features).toBeUndefined());
  it("feature at 200 chars passes (boundary)",     () => expect(validateProduct(v({ features: ["x".repeat(200)] })).errors.features).toBeUndefined());
  it("feature at 201 chars fails",                 () => expect(validateProduct(v({ features: ["x".repeat(201)] })).errors.features).toBeTruthy());
  it("31 features fails (over max)",               () => expect(validateProduct(v({ features: Array(31).fill("feat") })).errors.features).toBeTruthy());
  it("30 features passes (max boundary)",          () => expect(validateProduct(v({ features: Array(30).fill("feat") })).errors.features).toBeUndefined());
  it("whitespace-only features are ignored",       () => expect(validateProduct(v({ features: ["  ", ""] })).errors.features).toBeUndefined());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — IMAGE
// ═════════════════════════════════════════════════════════════

describe("validateProduct › image", () => {
  it("empty image passes",                        () => expect(validateProduct(v({ image: "" })).errors.image).toBeUndefined());
  it("undefined image passes",                    () => expect(validateProduct(v({ image: undefined })).errors.image).toBeUndefined());
  it("valid https URL passes",                    () => expect(validateProduct(v({ image: "https://img.unsplash.com/x?w=400" })).errors.image).toBeUndefined());
  it("valid http URL passes",                     () => expect(validateProduct(v({ image: "http://cdn.example.com/photo.jpg" })).errors.image).toBeUndefined());
  it("bare domain without protocol fails",        () => expect(validateProduct(v({ image: "example.com/photo.jpg" })).errors.image).toBeTruthy());
  it("random text fails",                         () => expect(validateProduct(v({ image: "not-a-url" })).errors.image).toBeTruthy());
  it("ftp URL fails",                             () => expect(validateProduct(v({ image: "ftp://files.com/x" })).errors.image).toBeTruthy());
  it("URL over 500 chars fails",                  () => expect(validateProduct(v({ image: "https://x.com/" + "a".repeat(490) })).errors.image).toBeTruthy());
});

// ═════════════════════════════════════════════════════════════
// validateProduct — COMBINED / MULTI-FIELD
// ═════════════════════════════════════════════════════════════

describe("validateProduct › combined", () => {
  it("completely valid object returns valid=true and empty errors", () => {
    const result = validateProduct(VALID);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("multiple invalid fields accumulate all errors", () => {
    const result = validateProduct({
      name: "", price: "abc", stock: "-1",
      category: "Unknown", colors: [], sizes: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.price).toBeTruthy();
    expect(result.errors.stock).toBeTruthy();
    expect(result.errors.category).toBeTruthy();
    expect(result.errors.colors).toBeTruthy();
    expect(result.errors.sizes).toBeTruthy();
  });

  it("fixing all errors makes valid=true", () => {
    const result = validateProduct(VALID);
    expect(result.valid).toBe(true);
  });

  it("errors object has no extra phantom keys for valid input", () => {
    const { errors } = validateProduct(VALID);
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════
// validateField — single field extraction
// ═════════════════════════════════════════════════════════════

describe("validateField", () => {
  it("returns undefined for a valid field",         () => expect(validateField("name",  VALID)).toBeUndefined());
  it("returns error string for invalid name",       () => expect(validateField("name",  v({ name: "" }))).toBeTruthy());
  it("returns error string for invalid price",      () => expect(validateField("price", v({ price: "abc" }))).toBeTruthy());
  it("returns error string for invalid stock",      () => expect(validateField("stock", v({ stock: "-1" }))).toBeTruthy());
  it("returns undefined for a valid price",         () => expect(validateField("price", v({ price: "99.99" }))).toBeUndefined());
  it("returns undefined for a valid category",      () => expect(validateField("category", v({ category: "Dresses" }))).toBeUndefined());
  it("returns error for unknown category",          () => expect(validateField("category", v({ category: "Shoes" }))).toBeTruthy());
  it("returns undefined for unknown field key",     () => expect(validateField("nonExistentField", VALID)).toBeUndefined());
});
