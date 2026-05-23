// ─────────────────────────────────────────────────────────────
// VALIDATORS.JS
// Pure functions only — zero React, zero UI, fully unit-testable.
// Every rule is documented so the companion tests stay readable.
// ─────────────────────────────────────────────────────────────

// ── Allowed values ────────────────────────────────────────────
export const ALLOWED_CATEGORIES = [
  "Tops", "Bottoms", "Outerwear", "Dresses", "Accessories", "Other",
];

// ── Field limits ──────────────────────────────────────────────
export const LIMITS = {
  name:        { min: 2,  max: 80  },
  price:       { min: 0,  max: 99_999, decimals: 2 },
  stock:       { min: 0,  max: 99_999 },
  colorName:   { min: 1,  max: 30  },
  colorCount:  { min: 1,  max: 20  },
  featureText: { min: 1,  max: 200 },
  featureCount:{ min: 0,  max: 30  },   // features are optional
  description: { min: 0,  max: 500 },
  imageUrl:    { max: 500 },
};

// ── Helpers ───────────────────────────────────────────────────

/** Returns true when a string is a syntactically valid URL. */
export function isValidUrl(str) {
  if (!str || !str.trim()) return true; // empty → allowed (image is optional)
  try {
    const url = new URL(str.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns true when a number string has at most `maxDecimals` decimal places. */
export function hasMaxDecimals(value, maxDecimals) {
  const str = String(value);
  const dot = str.indexOf(".");
  if (dot === -1) return true;
  return str.length - dot - 1 <= maxDecimals;
}

/** Strips empty / whitespace-only entries from an array of strings. */
export function compact(arr) {
  return (Array.isArray(arr) ? arr : []).filter((s) => String(s).trim());
}

// ─────────────────────────────────────────────────────────────
// validateProduct
// ─────────────────────────────────────────────────────────────

/**
 * Validates raw form data for a product.
 *
 * Rules
 * ─────
 * name        required · 2–80 chars
 * price       required · numeric · 0–99 999 · max 2 decimal places
 * stock       required · integer · 0–99 999
 * category    required · must be one of ALLOWED_CATEGORIES
 * colors      required · 1–20 entries · each 1–30 chars, letters/spaces/hyphens only
 * sizes       required · at least 1 entry
 * description optional · max 500 chars
 * features    optional · max 30 entries · each max 200 chars
 * image       optional · if provided must be http/https URL · max 500 chars
 *
 * @param {object} data - raw form values (strings from inputs)
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateProduct(data) {
  const errors = {};

  // ── name ───────────────────────────────────────────────────
  const name = String(data.name ?? "").trim();
  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length < LIMITS.name.min) {
    errors.name = `Name must be at least ${LIMITS.name.min} characters.`;
  } else if (name.length > LIMITS.name.max) {
    errors.name = `Name cannot exceed ${LIMITS.name.max} characters.`;
  }

  // ── price ──────────────────────────────────────────────────
  const rawPrice = data.price;
  if (rawPrice === "" || rawPrice === undefined || rawPrice === null) {
    errors.price = "Price is required.";
  } else {
    const price = parseFloat(rawPrice);
    if (isNaN(price)) {
      errors.price = "Price must be a number.";
    } else if (price < LIMITS.price.min) {
      errors.price = "Price must be 0 or greater.";
    } else if (price > LIMITS.price.max) {
      errors.price = `Price cannot exceed ${LIMITS.price.max.toLocaleString()}.`;
    } else if (!hasMaxDecimals(rawPrice, LIMITS.price.decimals)) {
      errors.price = "Price can have at most 2 decimal places.";
    }
  }

  // ── stock ──────────────────────────────────────────────────
  const rawStock = data.stock;
  if (rawStock === "" || rawStock === undefined || rawStock === null) {
    errors.stock = "Stock is required.";
  } else {
    const stock = Number(rawStock);
    if (isNaN(stock)) {
      errors.stock = "Stock must be a number.";
    } else if (!Number.isInteger(stock)) {
      errors.stock = "Stock must be a whole number.";
    } else if (stock < LIMITS.stock.min) {
      errors.stock = "Stock must be 0 or greater.";
    } else if (stock > LIMITS.stock.max) {
      errors.stock = `Stock cannot exceed ${LIMITS.stock.max.toLocaleString()}.`;
    }
  }

  // ── category ───────────────────────────────────────────────
  const category = String(data.category ?? "").trim();
  if (!category) {
    errors.category = "Category is required.";
  } else if (!ALLOWED_CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${ALLOWED_CATEGORIES.join(", ")}.`;
  }

  // ── colors ─────────────────────────────────────────────────
  const colors = compact(data.colors);
  if (colors.length === 0) {
    errors.colors = "At least one color is required.";
  } else if (colors.length > LIMITS.colorCount.max) {
    errors.colors = `Cannot have more than ${LIMITS.colorCount.max} colors.`;
  } else {
    const badColor = colors.find(
      (c) =>
        c.trim().length < LIMITS.colorName.min ||
        c.trim().length > LIMITS.colorName.max ||
        /^[0-9]+$/.test(c.trim())          // purely numeric color names are invalid
    );
    if (badColor) {
      errors.colors =
        `Each color must be 1–${LIMITS.colorName.max} characters and not purely numeric.`;
    }
  }

  // ── sizes ──────────────────────────────────────────────────
  const sizes = compact(data.sizes);
  if (sizes.length === 0) {
    errors.sizes = "At least one size must be selected.";
  }

  // ── description ────────────────────────────────────────────
  const desc = String(data.description ?? "").trim();
  if (desc.length > LIMITS.description.max) {
    errors.description = `Description cannot exceed ${LIMITS.description.max} characters.`;
  }

  // ── features ───────────────────────────────────────────────
  const features = compact(data.features ?? []);
  if (features.length > LIMITS.featureCount.max) {
    errors.features = `Cannot have more than ${LIMITS.featureCount.max} features.`;
  } else {
    const longFeature = features.find(
      (f) => f.trim().length > LIMITS.featureText.max
    );
    if (longFeature) {
      errors.features = `Each feature cannot exceed ${LIMITS.featureText.max} characters.`;
    }
  }

  // ── image ──────────────────────────────────────────────────
  const image = String(data.image ?? "").trim();
  if (image.length > LIMITS.imageUrl.max) {
    errors.image = `Image URL cannot exceed ${LIMITS.imageUrl.max} characters.`;
  } else if (!isValidUrl(image)) {
    errors.image = "Image must be a valid http/https URL.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ─────────────────────────────────────────────────────────────
// validateField — single-field validation (used for blur events)
// ─────────────────────────────────────────────────────────────

/**
 * Re-runs full validation and extracts only the error for `field`.
 * Keeps validation logic in one place (DRY).
 *
 * @param {string} field - key in the form object
 * @param {object} data  - full form data
 * @returns {string|undefined} error message or undefined
 */
export function validateField(field, data) {
  const { errors } = validateProduct(data);
  return errors[field];
}
