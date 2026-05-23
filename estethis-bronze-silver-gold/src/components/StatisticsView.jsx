// ─────────────────────────────────────────────────────────────
// STATISTICS VIEW  — Admin panel
// Visual tab  : KPI strip + horizontal bars + donut + vertical bars + ranking
// Tabular tab : full sortable product table with stars & status
// Both derive from the same `products` prop — always in sync.
// ─────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { Logo, GoldDivider } from "./Shared";

const CAT_COLORS = {
  Tops: "#c9a84c", Bottoms: "#8fa8c8", Outerwear: "#9b7fa6",
  Dresses: "#c87878", Accessories: "#6aac8a", Other: "#888",
};
const catColor = (cat) => CAT_COLORS[cat] ?? CAT_COLORS.Other;

function inferCategory(p) {
  if (p.category) return p.category;
  const n = (p.name || "").toLowerCase();
  if (n.includes("trouser") || n.includes("chino") || n.includes("skirt")) return "Bottoms";
  if (n.includes("coat") || n.includes("blazer") || n.includes("jacket")) return "Outerwear";
  if (n.includes("dress") || n.includes("gown")) return "Dresses";
  if (n.includes("bag") || n.includes("necklace") || n.includes("earring") || n.includes("belt")) return "Accessories";
  return "Tops";
}

function computeRating(p, maxSV) {
  if (p.stock === 0) return 1;
  const sv = p.price * p.stock;
  const ratio = maxSV > 0 ? sv / maxSV : 0;
  return Math.max(1, Math.round(ratio * 4) + 1);
}

function Stars({ rating }) {
  return (
    <span style={{ color: "#c9a84c", fontSize: 13, letterSpacing: 1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ opacity: i <= rating ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  );
}

function StatusBadge({ stock }) {
  const { label, cls } =
    stock === 0 ? { label: "OUT", cls: "badge--out" } :
    stock < 5   ? { label: "LOW", cls: "badge--low" } :
                  { label: "OK",  cls: "badge--ok"  };
  return <span className={`status-badge ${cls}`}>{label}</span>;
}

function HBar({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{
            fontFamily: "Montserrat,sans-serif", fontSize: 10, letterSpacing: "0.08em",
            color: "rgba(240,235,224,0.5)", width: 90, textAlign: "right", flexShrink: 0,
          }}>{d.label}</span>
          <div style={{
            flex: 1, height: 22, background: "rgba(255,255,255,0.05)",
            borderRadius: 2, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${(d.value / max) * 100}%`,
              background: `linear-gradient(90deg, ${d.color}, ${d.color}bb)`,
              borderRadius: 2, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
            }} />
          </div>
          <span style={{
            fontFamily: "Montserrat,sans-serif", fontSize: 11,
            color: "rgba(240,235,224,0.65)", width: 32, flexShrink: 0,
          }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }) {
  const R = 68, r = 38, cx = 90, cy = 90;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cum = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const s = cum; cum += angle; const e = cum;
    const x1 = cx + R*Math.cos(s), y1 = cy + R*Math.sin(s);
    const x2 = cx + R*Math.cos(e), y2 = cy + R*Math.sin(e);
    const xi1 = cx + r*Math.cos(e), yi1 = cy + r*Math.sin(e);
    const xi2 = cx + r*Math.cos(s), yi2 = cy + r*Math.sin(s);
    const lg = angle > Math.PI ? 1 : 0;
    return { ...d, path: `M${x1},${y1} A${R},${R} 0 ${lg},1 ${x2},${y2} L${xi1},${yi1} A${r},${r} 0 ${lg},0 ${xi2},${yi2} Z` };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg viewBox="0 0 180 180" style={{ width: 160, flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity="0.9" className="donut-slice" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22"
          fontFamily="\'Playfair Display\',serif" fill="#c9a84c">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8"
          fontFamily="Montserrat,sans-serif" fill="rgba(240,235,224,0.35)" letterSpacing="2">UNITS</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, background: d.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "rgba(240,235,224,0.65)" }}>{d.label}</span>
            <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, color: "rgba(240,235,224,0.35)" }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 600, H = 180, PL = 16, PR = 16, PT = 32, PB = 40;
  const iw = W - PL - PR, ih = H - PT - PB;
  const bw = Math.max(10, Math.floor(iw / data.length) - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {data.map((d, i) => {
        const bh = (d.value / max) * ih;
        const x  = PL + i * (iw / data.length) + (iw / data.length - bw) / 2;
        const y  = PT + ih - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} fill={d.color ?? "#c9a84c"}
              opacity="0.85" rx="2" className="bar-animate"
              style={{ transformOrigin: `${x + bw/2}px ${PT + ih}px` }} />
            <text x={x + bw/2} y={y - 5} textAnchor="middle" fontSize="8"
              fill="rgba(240,235,224,0.55)" fontFamily="Montserrat,sans-serif">${d.value}</text>
            <text x={x + bw/2} y={PT + ih + 16} textAnchor="middle" fontSize="8"
              fill="rgba(240,235,224,0.35)" fontFamily="Montserrat,sans-serif">
              {(d.label || "").slice(0,7)}
            </text>
          </g>
        );
      })}
      <line x1={PL} x2={W - PR} y1={PT + ih} y2={PT + ih}
        stroke="rgba(201,168,76,0.2)" strokeWidth="1" />
    </svg>
  );
}

export default function StatisticsView({ products, onBack, onAdd, onEdit, onDelete }) {
  const [activeTab, setActiveTab] = useState("visual");
  const [sortField, setSortField] = useState("stockValue");
  const [sortDir,   setSortDir]   = useState("desc");

  const rows = useMemo(() => {
    const maxSV = Math.max(...products.map(p => p.price * p.stock), 1);
    return products.map(p => ({
      ...p,
      category:   inferCategory(p),
      stockValue: p.price * p.stock,
      rating:     p.rating ?? computeRating(p, maxSV),
    }));
  }, [products]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : (av - bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

  const toggleSort = (field) => {
    if (field === sortField) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const catGroups = useMemo(() => {
    const map = {};
    rows.forEach(r => { if (!map[r.category]) map[r.category] = 0; map[r.category] += r.stock; });
    return Object.entries(map).map(([l, v]) => ({ label: l, value: v, color: catColor(l) })).sort((a,b) => b.value - a.value);
  }, [rows]);

  const totalStock = rows.reduce((s, r) => s + r.stock, 0);
  const avgPrice   = rows.length ? Math.round(rows.reduce((s,r) => s + r.price, 0) / rows.length) : 0;
  const outOfStock = rows.filter(r => r.stock === 0).length;
  const priceData  = [...rows].sort((a,b) => b.price - a.price).slice(0,10).map(r => ({ label: r.name.split(" ")[0], value: r.price, color: catColor(r.category) }));
  const rankingRows= [...rows].sort((a,b) => b.stockValue - a.stockValue).slice(0,6);

  const TH = ({ label, field, style = {} }) => (
    <th className={`stat-tab-th ${field ? "stat-tab-th--sort" : ""} ${sortField === field ? "stat-tab-th--active" : ""}`}
      onClick={() => field && toggleSort(field)} style={style}>
      {label}{field && <span className="sort-arrow">{sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}</span>}
    </th>
  );

  return (
    <div className="stats-page page-enter">
      {/* NAV */}
      <div className="stats-topnav">
        <Logo onClick={onBack} />
        <nav className="stats-topnav__tabs">
          <button className="stats-topnav__link" onClick={onBack}>PRODUCTS</button>
          <button className="stats-topnav__link stats-topnav__link--active">STATISTICS</button>
          <button className="stats-topnav__link" style={{ opacity: 0.3, cursor: "default" }}>ORDERS</button>
        </nav>
        <span className="stats-topnav__admin">Admin Panel</span>
      </div>
      <GoldDivider style={{ width: "100%" }} />

      {/* PAGE HEADER */}
      <div className="stats-header">
        <div>
          <h1 className="stats-heading">Statistics</h1>
          <p className="stats-subheading">PRODUCT PERFORMANCE OVERVIEW</p>
        </div>
        <div className="stats-toggle">
          <button className={`stats-toggle-btn ${activeTab === "visual" ? "stats-toggle-btn--active" : ""}`}
            onClick={() => setActiveTab("visual")}>Visual</button>
          <button className={`stats-toggle-btn ${activeTab === "tabular" ? "stats-toggle-btn--active" : ""}`}
            onClick={() => setActiveTab("tabular")}>Tabular</button>
        </div>
      </div>

      {/* VISUAL TAB */}
      {activeTab === "visual" && (
        <>
          <div className="kpi-strip">
            {[
              { label: "TOTAL PRODUCTS", value: rows.length,    sub: `Across ${catGroups.length} categories` },
              { label: "TOTAL STOCK",    value: totalStock,      sub: "Units in inventory" },
              { label: "AVG. PRICE",     value: `$${avgPrice}`,  sub: "Across all products" },
              { label: "OUT OF STOCK",   value: outOfStock,      sub: "Need restocking", red: outOfStock > 0 },
            ].map((k, i) => (
              <div className="kpi-card" key={i}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ color: k.red ? "#c05050" : undefined }}>{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="vis-grid">
            <div className="vis-card">
              <p className="vis-card-title">STOCK BY CATEGORY</p>
              <HBar data={catGroups} />
            </div>
            <div className="vis-card">
              <p className="vis-card-title">CATEGORY DISTRIBUTION</p>
              <DonutChart data={catGroups} />
            </div>
            <div className="vis-card">
              <p className="vis-card-title">PRICE RANGE</p>
              <VBarChart data={priceData} />
            </div>
            <div className="vis-card">
              <p className="vis-card-title">PRODUCT RANKING BY STOCK VALUE</p>
              {rankingRows.map((r, i) => (
                <div key={r.id} style={{
                  display: "grid", gridTemplateColumns: "24px 1fr auto auto",
                  alignItems: "center", gap: 12, padding: "11px 0",
                  borderBottom: i < rankingRows.length - 1 ? "1px solid rgba(201,168,76,0.08)" : "none",
                }}>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, color: "rgba(240,235,224,0.3)" }}>{i+1}</span>
                  <span style={{ fontFamily: "\'Playfair Display\',serif", fontSize: 14, color: "rgba(240,235,224,0.85)" }}>{r.name}</span>
                  <Stars rating={r.rating} />
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, color: "#c9a84c", textAlign: "right" }}>${r.price}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* TABULAR TAB */}
      {activeTab === "tabular" && (
        <div style={{ padding: "24px 32px" }}>
          <div className="tab-table-wrap">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(201,168,76,0.12)" }}>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 9, letterSpacing: "0.22em", color: "rgba(201,168,76,0.5)" }}>
                FULL PRODUCT STATISTICS
              </span>
            </div>
            <table className="stat-tab-table">
              <thead>
                <tr>
                  <TH label="RANK"        field="stockValue" style={{ width: 60 }} />
                  <TH label="PRODUCT"     field="name" />
                  <TH label="CATEGORY"    field="category" style={{ width: 110 }} />
                  <TH label="PRICE"       field="price"      style={{ width: 72 }} />
                  <TH label="STOCK"       field="stock"      style={{ width: 62 }} />
                  <TH label="STOCK VALUE" field="stockValue" style={{ width: 100 }} />
                  <TH label="RATING"      field="rating"     style={{ width: 110 }} />
                  <TH label="STATUS"      style={{ width: 62 }} />
                  <th className="stat-tab-th" style={{ width: 72 }} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, idx) => (
                  <tr key={p.id} className={`stat-tab-row stat-tab-row--${idx}`}
                    style={{ animationDelay: `${idx * 30}ms` }}>
                    <td className="stat-tab-td">
                      <span className={`rank-box ${idx < 3 ? "rank-box--top" : ""}`}>{idx + 1}</span>
                    </td>
                    <td className="stat-tab-td stat-tab-td--name">
                      {p.image && <img src={p.image} alt="" style={{
                        width: 32, height: 32, objectFit: "cover",
                        border: "1px solid rgba(201,168,76,0.15)", marginRight: 10, flexShrink: 0,
                      }} onError={e => { e.target.style.display="none"; }} />}
                      {p.name}
                    </td>
                    <td className="stat-tab-td stat-tab-td--cat" style={{ color: catColor(p.category) }}>
                      {(p.category || "").toUpperCase()}
                    </td>
                    <td className="stat-tab-td stat-tab-td--num">${p.price}</td>
                    <td className="stat-tab-td stat-tab-td--num">{p.stock}</td>
                    <td className="stat-tab-td stat-tab-td--num" style={{ color: "#c9a84c" }}>
                      ${p.stockValue.toLocaleString()}
                    </td>
                    <td className="stat-tab-td"><Stars rating={p.rating} /></td>
                    <td className="stat-tab-td"><StatusBadge stock={p.stock} /></td>
                    <td className="stat-tab-td" style={{ display: "flex", gap: 6, justifyContent: "center" }}
                      onClick={e => e.stopPropagation()}>
                      <button className="icon-btn icon-btn--edit"   onClick={() => onEdit(p.id)}   title="Edit">✎</button>
                      <button className="icon-btn icon-btn--delete" onClick={() => onDelete(p.id)} title="Delete">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
