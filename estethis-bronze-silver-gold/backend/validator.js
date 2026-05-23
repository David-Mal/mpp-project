// ─────────────────────────────────────────────────────────────
// VALIDATOR — server-side input validation (middleware)
// Validates name, price, category (required) +
//            stock, colors, sizes, description, features, image (optional)
// ─────────────────────────────────────────────────────────────

const ALLOWED_CATEGORIES = [
  'Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Accessories', 'Other',
];

export function validateProduct(req, res, next) {
  const { name, price, category, stock, colors, sizes } = req.body;
  const errors = [];

  // name — required, 2–80 chars
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('name: required, minimum 2 characters.');
  } else if (name.trim().length > 80) {
    errors.push('name: maximum 80 characters.');
  }

  // price — required, non-negative number
  if (price === undefined || price === null) {
    errors.push('price: required.');
  } else if (typeof price !== 'number' || isNaN(price) || price < 0) {
    errors.push('price: must be a non-negative number.');
  } else if (price > 99_999) {
    errors.push('price: must not exceed 99 999.');
  }

  // category — required, must be one of allowed values
  if (!category || typeof category !== 'string') {
    errors.push('category: required.');
  } else if (!ALLOWED_CATEGORIES.includes(category)) {
    errors.push(`category: must be one of ${ALLOWED_CATEGORIES.join(', ')}.`);
  }

  // stock — optional, non-negative integer
  if (stock !== undefined && stock !== null) {
    const s = parseInt(stock, 10);
    if (isNaN(s) || s < 0) {
      errors.push('stock: must be a non-negative integer.');
    }
  }

  // colors — optional array, each entry max 30 chars
  if (colors !== undefined) {
    if (!Array.isArray(colors)) {
      errors.push('colors: must be an array.');
    } else if (colors.length > 20) {
      errors.push('colors: maximum 20 entries.');
    }
  }

  // sizes — optional array
  if (sizes !== undefined && !Array.isArray(sizes)) {
    errors.push('sizes: must be an array.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  next();
}
