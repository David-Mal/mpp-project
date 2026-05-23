// ─────────────────────────────────────────────────────────────
// LIVE CHARTS (Silver)
// Compact metrics strip that sits next to the master table and
// updates instantly on every products mutation — including the
// real-time batches arriving through WebSocket from the Faker
// generator.
//
// Pure SVG (no chart library) so the visual stays consistent with
// the rest of the app and zero new dependencies are added. The
// detailed dashboard already lives in StatisticsView; this is the
// "side by side" companion the Silver spec asks for.
// ─────────────────────────────────────────────────────────────

import { useMemo } from 'react';

// Buckets — same edges as the backend stats so the two stay coherent.
const PRICE_EDGES  = [0, 50, 100, 200, 500, Infinity];
const PRICE_LABELS = ['0–50', '50–100', '100–200', '200–500', '500+'];
const STOCK_EDGES  = [0, 1, 4, 10, 20, Infinity];
const STOCK_LABELS = ['0', '1–3', '4–9', '10–20', '20+'];

const CAT_COLORS = {
  Tops: '#c9a84c', Bottoms: '#8fa8c8', Outerwear: '#9b7fa6',
  Dresses: '#c87878', Accessories: '#6aac8a', Other: '#888',
};

function bucketize(values, edges, labels) {
  const counts = labels.map(() => 0);
  for (const v of values) {
    for (let i = 0; i < edges.length - 1; i++) {
      if (v >= edges[i] && v < edges[i + 1]) { counts[i]++; break; }
    }
  }
  return labels.map((label, i) => ({ label, count: counts[i] }));
}
function round2(n) { return Math.round(n * 100) / 100; }

export default function LiveCharts({ products }) {
  const stats = useMemo(() => {
    const list = products || [];
    if (list.length === 0) {
      return {
        total: 0,
        avgPrice: 0,
        avgStock: 0,
        priceBuckets: PRICE_LABELS.map((label) => ({ label, count: 0 })),
        stockBuckets: STOCK_LABELS.map((label) => ({ label, count: 0 })),
        categories:   [],
      };
    }
    const total = list.length;
    const avgPrice = round2(list.reduce((s, p) => s + (Number(p.price) || 0), 0) / total);
    const avgStock = round2(list.reduce((s, p) => s + (Number(p.stock) || 0), 0) / total);

    const priceBuckets = bucketize(list.map((p) => Number(p.price) || 0), PRICE_EDGES, PRICE_LABELS);
    const stockBuckets = bucketize(list.map((p) => Number(p.stock) || 0), STOCK_EDGES, STOCK_LABELS);

    const counts = {};
    for (const p of list) {
      const cat = p.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const categories = Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    return { total, avgPrice, avgStock, priceBuckets, stockBuckets, categories };
  }, [products]);

  return (
    <aside className="livecharts">
      <header className="livecharts__header">
        <span className="livecharts__eyebrow">LIVE METRICS</span>
        <span className="livecharts__total">
          {stats.total} {stats.total === 1 ? 'item' : 'items'} · avg <strong>${stats.avgPrice}</strong>
        </span>
      </header>

      <BarChart title="PRICE" buckets={stats.priceBuckets} />
      <BarChart title="STOCK" buckets={stats.stockBuckets} />
      <CategoryDots categories={stats.categories} />
    </aside>
  );
}

function BarChart({ title, buckets }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const W = 240, H = 90, PAD_X = 10, PAD_BOTTOM = 22, PAD_TOP = 8;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_BOTTOM - PAD_TOP;
  const slotW  = innerW / buckets.length;
  const barW   = Math.max(8, slotW * 0.55);

  return (
    <figure className="livecharts__card">
      <figcaption className="livecharts__title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="livecharts__svg">
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM}
              stroke="rgba(201,168,76,0.25)" strokeWidth="0.5" />
        {buckets.map((b, i) => {
          const ratio = b.count / max;
          const h = ratio * innerH;
          const x = PAD_X + slotW * i + (slotW - barW) / 2;
          const y = H - PAD_BOTTOM - h;
          return (
            <g key={b.label}>
              <rect
                x={x} y={y} width={barW} height={h}
                fill="#c9a84c" opacity={0.85}
                style={{ transition: 'y 350ms ease, height 350ms ease' }}
              />
              {b.count > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle"
                      fontSize="8" fontFamily="Montserrat,sans-serif" fill="#c9a84c">
                  {b.count}
                </text>
              )}
              <text x={x + barW / 2} y={H - PAD_BOTTOM + 11} textAnchor="middle"
                    fontSize="7" fontFamily="Montserrat,sans-serif" fill="rgba(240,235,224,0.5)"
                    letterSpacing="0.08em">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function CategoryDots({ categories }) {
  if (categories.length === 0) {
    return (
      <figure className="livecharts__card">
        <figcaption className="livecharts__title">CATEGORIES</figcaption>
        <div className="livecharts__empty">Nothing yet.</div>
      </figure>
    );
  }
  const max = Math.max(1, ...categories.map((c) => c.count));
  return (
    <figure className="livecharts__card">
      <figcaption className="livecharts__title">CATEGORIES</figcaption>
      <ul className="livecharts__cats">
        {categories.map((c) => (
          <li key={c.label} className="livecharts__cat">
            <span className="livecharts__cat-dot" style={{ background: CAT_COLORS[c.label] || CAT_COLORS.Other }} />
            <span className="livecharts__cat-label">{c.label}</span>
            <span className="livecharts__cat-track">
              <span
                className="livecharts__cat-fill"
                style={{
                  width: `${(c.count / max) * 100}%`,
                  background: CAT_COLORS[c.label] || CAT_COLORS.Other,
                }}
              />
            </span>
            <span className="livecharts__cat-count">{c.count}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
