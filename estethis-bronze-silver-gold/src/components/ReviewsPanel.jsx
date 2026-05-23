// ─────────────────────────────────────────────────────────────
// REVIEWS PANEL (Gold — 1-to-many)
// Embedded inside DetailView. Shows all reviews for one product,
// lets users add/delete reviews, and displays an avg-rating
// summary with a 1–5 star distribution chart.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';

const API = (path) => `/api${path}`;

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

// ── Star display ─────────────────────────────────────────────
function Stars({ value, size = 14 }) {
  return (
    <span style={{ fontSize: size, color: '#c9a84c', letterSpacing: 1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(value) ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  );
}

// ── Rating distribution mini-bar chart ───────────────────────
function RatingBars({ distribution, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {[...distribution].reverse().map(({ star, count }) => (
        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10,
          fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.08em' }}>
          <span style={{ color: 'rgba(201,168,76,0.7)', width: 16 }}>{star}★</span>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }}>
            <div style={{
              height: '100%', borderRadius: 1,
              width: total > 0 ? `${(count / total) * 100}%` : '0%',
              background: '#c9a84c',
              transition: 'width 400ms ease',
            }} />
          </div>
          <span style={{ color: 'rgba(240,235,224,0.45)', width: 16, textAlign: 'right' }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReviewsPanel({ productId, online = true }) {
  const [reviews,    setReviews]    = useState([]);
  const [stats,      setStats]      = useState({ count: 0, avgRating: 0, distribution: [] });
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState(null);
  const [form, setForm] = useState({ author: '', rating: '5', comment: '' });

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        apiFetch(API(`/products/${productId}/reviews?limit=100`)),
        apiFetch(API(`/products/${productId}/reviews/stats`)),
      ]);
      setReviews(listRes.data ?? []);
      setStats(statsRes);
    } catch { setReviews([]); }
    finally { setLoading(false); }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!online) { setFormError('Offline — cannot post reviews.'); return; }
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch(API(`/products/${productId}/reviews`), {
        method: 'POST',
        body: JSON.stringify({ ...form, rating: parseInt(form.rating, 10) }),
      });
      setReviews(prev => [created, ...prev]);
      // Refresh stats
      const statsRes = await apiFetch(API(`/products/${productId}/reviews/stats`));
      setStats(statsRes);
      setForm({ author: '', rating: '5', comment: '' });
    } catch (err) { setFormError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!online) return;
    await apiFetch(API(`/reviews/${id}`), { method: 'DELETE' }).catch(() => {});
    setReviews(prev => prev.filter(r => r.id !== id));
    const statsRes = await apiFetch(API(`/products/${productId}/reviews/stats`)).catch(() => stats);
    setStats(statsRes ?? stats);
  };

  return (
    <section className="reviews-panel">
      <header className="reviews-panel__header">
        <h3 className="reviews-panel__title">CUSTOMER REVIEWS</h3>
        <div className="reviews-panel__divider" />
      </header>

      {/* Summary: avg + distribution */}
      {stats.count > 0 && (
        <div className="reviews-panel__summary">
          <div className="reviews-panel__avg-block">
            <div className="reviews-panel__avg-num">{stats.avgRating.toFixed(1)}</div>
            <Stars value={stats.avgRating} size={16} />
            <div className="reviews-panel__avg-sub">{stats.count} review{stats.count !== 1 ? 's' : ''}</div>
          </div>
          {stats.distribution?.length > 0 && (
            <div className="reviews-panel__bars" style={{ flex: 1 }}>
              <RatingBars distribution={stats.distribution} total={stats.count} />
            </div>
          )}
        </div>
      )}

      {/* Add review form */}
      <form className="reviews-panel__form" onSubmit={handleSubmit}>
        <div className="reviews-panel__form-row">
          <input
            className="reviews-panel__input"
            placeholder="YOUR NAME"
            value={form.author}
            onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
            required maxLength={60}
          />
          <select
            className="reviews-panel__select"
            value={form.rating}
            onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}
          >
            {[5,4,3,2,1].map(r => (
              <option key={r} value={r}>{r} ★</option>
            ))}
          </select>
        </div>
        <textarea
          className="reviews-panel__textarea"
          placeholder="WRITE YOUR REVIEW…"
          value={form.comment}
          onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
          required minLength={3} maxLength={500} rows={3}
        />
        {formError && <p className="reviews-panel__form-error">{formError}</p>}
        <button
          className="reviews-panel__submit"
          type="submit"
          disabled={submitting || !online}
        >
          {submitting ? 'POSTING…' : !online ? 'OFFLINE' : 'POST REVIEW'}
        </button>
      </form>

      {/* Reviews list */}
      <div className="reviews-panel__list">
        {loading && <div className="reviews-panel__loading">Loading reviews…</div>}
        {!loading && reviews.length === 0 && (
          <div className="reviews-panel__empty">No reviews yet — be the first.</div>
        )}
        {reviews.map(r => (
          <article key={r.id} className="reviews-panel__item">
            <div className="reviews-panel__item-head">
              <span className="reviews-panel__author">{r.author}</span>
              <Stars value={r.rating} size={12} />
              {online && (
                <button
                  className="reviews-panel__delete"
                  onClick={() => handleDelete(r.id)}
                  title="Delete review"
                >×</button>
              )}
            </div>
            <p className="reviews-panel__comment">{r.comment}</p>
            <div className="reviews-panel__date">
              {new Date(r.createdAt).toLocaleDateString()}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
