// ─────────────────────────────────────────────────────────────
// REVIEW VALIDATOR — middleware + pure helper
// ─────────────────────────────────────────────────────────────

export function validateReview(req, res, next) {
  const { author, rating, comment } = req.body;
  const errors = [];

  if (!author || typeof author !== 'string' || author.trim().length < 2)
    errors.push('author: required, minimum 2 characters.');
  else if (author.trim().length > 60)
    errors.push('author: maximum 60 characters.');

  const r = parseInt(rating, 10);
  if (rating === undefined || rating === null)
    errors.push('rating: required (1–5).');
  else if (isNaN(r) || r < 1 || r > 5)
    errors.push('rating: must be an integer 1–5.');

  if (!comment || typeof comment !== 'string' || comment.trim().length < 3)
    errors.push('comment: required, minimum 3 characters.');
  else if (comment.trim().length > 500)
    errors.push('comment: maximum 500 characters.');

  if (errors.length > 0)
    return res.status(400).json({ error: errors.join(' ') });

  next();
}

/** Pure validation used by the GraphQL resolver (no req/res). */
export function validateReviewData(data) {
  const errors = [];
  const { author, rating, comment } = data;

  if (!author || String(author).trim().length < 2)
    errors.push('author: required, minimum 2 characters.');
  else if (String(author).trim().length > 60)
    errors.push('author: maximum 60 characters.');

  const r = parseInt(rating, 10);
  if (rating === undefined || rating === null || isNaN(r) || r < 1 || r > 5)
    errors.push('rating: must be an integer 1–5.');

  if (!comment || String(comment).trim().length < 3)
    errors.push('comment: required, minimum 3 characters.');
  else if (String(comment).trim().length > 500)
    errors.push('comment: maximum 500 characters.');

  return errors;
}
