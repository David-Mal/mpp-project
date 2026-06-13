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

// ── Admin: expandable order card ─────────────────────────────
function AdminOrderCard({ order }) {
  const [open, setOpen] = useState(false);
  const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const shortId = (order.id || '').slice(-8).toUpperCase();
  return (
    <div className={`admin-order-card${open ? ' admin-order-card--open' : ''}`}>
      <div className="admin-order-card__header" onClick={() => setOpen(p => !p)}>
        <span className="admin-order-card__id">#{shortId}</span>
        <span className="admin-order-card__date">{date}</span>
        <span className="admin-order-card__user">User&nbsp;#{order.userId ?? '—'}</span>
        <span className="admin-order-card__count">{(order.items ?? []).length} item{(order.items ?? []).length !== 1 ? 's' : ''}</span>
        <span className="admin-order-card__total">${(order.total ?? 0).toFixed(2)}</span>
        <span className="admin-order-card__status">✓ {(order.status || 'confirmed').toUpperCase()}</span>
        <span className="admin-order-card__chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="admin-order-card__body">
          {(order.items ?? []).map((item, i) => (
            <div key={i} className="admin-order-item">
              {item.productImage && (
                <img src={item.productImage} alt={item.productName}
                  className="admin-order-item__img"
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
              <span className="admin-order-item__name">{item.productName}</span>
              {item.selectedColor && <span className="admin-order-item__meta">{item.selectedColor}</span>}
              {item.selectedSize  && <span className="admin-order-item__meta">{item.selectedSize}</span>}
              <span className="admin-order-item__qty">×{item.quantity}</span>
              <span className="admin-order-item__price">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          {order.shippingAddress && (
            <div className="admin-order-shipping">
              <span className="admin-order-shipping__label">SHIP TO</span>
              <span className="admin-order-shipping__val">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName},&nbsp;
                {order.shippingAddress.address},&nbsp;
                {order.shippingAddress.city},&nbsp;
                {order.shippingAddress.country}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin: expandable message card ────────────────────────────
function AdminMessageCard({ msg, onMarkRead }) {
  const [open, setOpen] = useState(false);
  const date = msg.sentAt ? new Date(msg.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const handleToggle = () => {
    setOpen(p => !p);
    if (!msg.read && onMarkRead) onMarkRead(msg.id);
  };

  return (
    <div className={`admin-msg-card${msg.read ? '' : ' admin-msg-card--unread'}${open ? ' admin-msg-card--open' : ''}`}>
      <div className="admin-msg-card__header" onClick={handleToggle}>
        <span className={`admin-msg-card__dot${msg.read ? ' admin-msg-card__dot--read' : ''}`}>●</span>
        <span className="admin-msg-card__name">{msg.name}</span>
        <span className="admin-msg-card__email">{msg.email}</span>
        <span className="admin-msg-card__subject">{msg.subject || '(No subject)'}</span>
        <span className="admin-msg-card__date">{date}</span>
        <span className="admin-msg-card__chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="admin-msg-card__body">
          <p className="admin-msg-card__text">{msg.message}</p>
          <p className="admin-msg-card__reply-hint">
            Reply to: <a href={`mailto:${msg.email}`} className="admin-msg-card__email-link">{msg.email}</a>
          </p>
        </div>
      )}
    </div>
  );
}

export default function StatisticsView({ products, onBack, onAdd, onEdit, onDelete, canWrite, isAdmin, orders, messages, onMarkMessageRead }) {
  const [activeTab, setActiveTab] = useState("visual");
  const [sortField, setSortField] = useState("stockValue");
  const [sortDir,   setSortDir]   = useState("desc");

  const allOrders   = orders   ?? [];
  const allMessages = messages ?? [];

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

  const totalStock      = rows.reduce((s, r) => s + r.stock, 0);
  const avgPrice        = rows.length ? Math.round(rows.reduce((s,r) => s + r.price, 0) / rows.length) : 0;
  const outOfStock      = rows.filter(r => r.stock === 0).length;
  const priceData       = [...rows].sort((a,b) => b.price - a.price).slice(0,10).map(r => ({ label: r.name.split(" ")[0], value: r.price, color: catColor(r.category) }));
  const rankingRows     = [...rows].sort((a,b) => b.stockValue - a.stockValue).slice(0,6);

  // Sales KPIs derived from orders
  const totalRevenue    = allOrders.reduce((s, o) => s + (o.total ?? 0), 0);
  const unreadCount     = allMessages.filter(m => !m.read).length;

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
          <button
            className={`stats-topnav__link${activeTab === 'visual' || activeTab === 'tabular' ? ' stats-topnav__link--active' : ''}`}
            onClick={() => setActiveTab('visual')}>
            STATISTICS
          </button>
          {canWrite && (
            <button
              className={`stats-topnav__link${activeTab === 'orders' ? ' stats-topnav__link--active' : ''}`}
              onClick={() => setActiveTab('orders')}>
              ORDERS
              {allOrders.length > 0 && (
                <span className="stats-topnav__badge">{allOrders.length}</span>
              )}
            </button>
          )}
          {isAdmin && (
            <button
              className={`stats-topnav__link${activeTab === 'inbox' ? ' stats-topnav__link--active' : ''}`}
              onClick={() => setActiveTab('inbox')}>
              INBOX
              {unreadCount > 0 && (
                <span className="stats-topnav__badge stats-topnav__badge--alert">{unreadCount}</span>
              )}
            </button>
          )}
        </nav>
        {canWrite && <span className="stats-topnav__admin">Admin Panel</span>}
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
              { label: "TOTAL PRODUCTS", value: rows.length,                         sub: `Across ${catGroups.length} categories` },
              { label: "TOTAL STOCK",    value: totalStock,                           sub: "Units in inventory" },
              { label: "AVG. PRICE",     value: `$${avgPrice}`,                       sub: "Across all products" },
              { label: "OUT OF STOCK",   value: outOfStock,                           sub: "Need restocking", red: outOfStock > 0 },
              { label: "TOTAL REVENUE",  value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,  sub: `From ${allOrders.length} order${allOrders.length !== 1 ? 's' : ''}`, gold: true },
              { label: "ORDERS PLACED",  value: allOrders.length,                    sub: "All time", gold: true },
            ].map((k, i) => (
              <div className="kpi-card" key={i}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ color: k.red ? "#c05050" : k.gold ? "#c9a84c" : undefined }}>{k.value}</div>
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
                  {canWrite && <th className="stat-tab-th" style={{ width: 72 }} />}
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
                    {canWrite && (
                      <td className="stat-tab-td" style={{ display: "flex", gap: 6, justifyContent: "center" }}
                        onClick={e => e.stopPropagation()}>
                        <button className="icon-btn icon-btn--edit"   onClick={() => onEdit(p.id)}   title="Edit">✎</button>
                        <button className="icon-btn icon-btn--delete" onClick={() => onDelete(p.id)} title="Delete">🗑</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ORDERS TAB */}
      {activeTab === "orders" && canWrite && (
        <div className="admin-tab-body">
          <div className="admin-tab-header">
            <h2 className="admin-tab-title">All Orders</h2>
            <span className="admin-tab-count">{allOrders.length} total</span>
          </div>
          {allOrders.length === 0 ? (
            <div className="admin-empty-state">
              <p className="admin-empty-state__icon">◫</p>
              <p className="admin-empty-state__text">No orders have been placed yet.</p>
            </div>
          ) : (
            <div className="admin-order-list">
              {allOrders.map(order => (
                <AdminOrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* INBOX TAB */}
      {activeTab === "inbox" && isAdmin && (
        <div className="admin-tab-body">
          <div className="admin-tab-header">
            <h2 className="admin-tab-title">Inbox</h2>
            <span className="admin-tab-count">
              {allMessages.length} message{allMessages.length !== 1 ? 's' : ''}
              {unreadCount > 0 && <span className="admin-tab-unread">&nbsp;·&nbsp;{unreadCount} unread</span>}
            </span>
          </div>
          {allMessages.length === 0 ? (
            <div className="admin-empty-state">
              <p className="admin-empty-state__icon">✉</p>
              <p className="admin-empty-state__text">No messages yet. They will appear here when visitors submit the Contact form.</p>
            </div>
          ) : (
            <div className="admin-msg-list">
              {allMessages.map(msg => (
                <AdminMessageCard key={msg.id} msg={msg} onMarkRead={onMarkMessageRead} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
