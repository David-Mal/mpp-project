// ─────────────────────────────────────────────────────────────
// MASTER VIEW — INFINITE SCROLL (Gold)
//
// Replaces numbered pagination with continuous scroll.
// An IntersectionObserver watches a sentinel element 300px above
// the last visible row. When the sentinel enters the viewport,
// loadMore() fires — the next page is already in-flight before
// the user reaches the actual bottom (prefetch).
//
// Search and sort are passed up to the parent which resets the
// infinite list and re-fetches from page 1 via the hook.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { Logo, GoldDivider } from './Shared';
import '../styles/components.css';

export default function MasterView({
  // infinite-scroll data from useInfiniteProducts
  items, hasMore, loading, total,
  // callbacks for search/sort (parent drives the hook)
  search, onSearchChange, sort, onSortChange,
  // navigation callbacks
  onView, onEdit, onDelete, onAdd, onStats, onHome, onAtelier,
  // auth-gated callbacks (null = hide button)
  onUsers, onLogs, onObservation, onLogout, canWrite, currentUser,
  // loadMore trigger
  onLoadMore,
  // Silver: side-by-side charts slot
  sideCharts,
}) {
  const sentinelRef = useRef(null);
  const [localSearch, setLocalSearch] = useState(search ?? '');

  // Debounce search → parent.
  useEffect(() => {
    const id = setTimeout(() => {
      if (localSearch !== (search ?? '')) onSearchChange?.(localSearch);
    }, 350);
    return () => clearTimeout(id);
  }, [localSearch, search, onSearchChange]);

  // IntersectionObserver — fires loadMore when sentinel enters viewport.
  // rootMargin "300px" means it fires 300px BEFORE the sentinel is visible,
  // so the next page is already loading when the user is still scrolling.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onLoadMore(); },
      { rootMargin: '300px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return (
    <div className={`master page-enter ${sideCharts ? 'master--with-charts' : ''}`}>

      {/* Header */}
      <div className="master__header">
        <Logo onClick={onHome} style={{ cursor: onHome ? 'pointer' : 'default' }} />

        <div style={{ textAlign: 'center', flex: 1 }}>
          <h1 className="master__title">PRODUCTS</h1>
          <GoldDivider style={{ margin: '6px auto 0', width: 80 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          {onStats && (
            <button className="stats-btn" onClick={onStats}>⬡ STATISTICS</button>
          )}
          {onAtelier && (
            <button className="stats-btn" onClick={onAtelier}
              style={{ borderColor: 'rgba(201,168,76,0.3)' }}>✦ ATELIER</button>
          )}
          {onUsers && (
            <button className="stats-btn" onClick={onUsers}
              style={{ borderColor: 'rgba(201,168,76,0.5)' }}>⚙ USERS</button>
          )}
          {onLogs && (
            <button className="stats-btn" onClick={onLogs}
              style={{ borderColor: 'rgba(201,168,76,0.4)' }}>◈ LOGS</button>
          )}
          {onObservation && (
            <button className="stats-btn" onClick={onObservation}
              style={{ borderColor: 'rgba(224,108,117,0.5)', color: '#e06c75' }}>⚠ THREATS</button>
          )}
          {canWrite && (
            <button className="add-btn" onClick={onAdd}>
              <span style={{
                width: 20, height: 20, border: '1px solid #c9a84c',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, lineHeight: 1,
              }}>+</span>
              add new product
            </button>
          )}
          {onLogout && (
            <button className="stats-btn" onClick={onLogout}
              style={{ borderColor: 'rgba(224,108,117,0.5)', color: '#e06c75', fontSize: 11 }}>
              {currentUser?.email ? `↩ ${currentUser.email.split('@')[0].toUpperCase()}` : '↩ LOGOUT'}
            </button>
          )}
        </div>
      </div>

      {/* Search + sort toolbar */}
      <div className="master__toolbar">
        <input
          className="search-input"
          placeholder="Search by name, category or color…"
          value={localSearch}
          onChange={e => { setLocalSearch(e.target.value); }}
        />
        <select
          className="sort-select"
          value={sort ?? ''}
          onChange={e => onSortChange?.(e.target.value)}
        >
          <option value="">Default order</option>
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
        </select>
        <span className="master__count">
          {items.length} / {total}
        </span>
      </div>

      {/* Table + charts */}
      <div className="master__body">
        <div className="table-wrap">

          <div className="table-head">
            <div className="table-head__cell">#</div>
            <div className="table-head__cell">Name</div>
            <div className="table-head__cell" style={{ textAlign: 'center' }}>Price</div>
            <div className="table-head__cell" style={{ textAlign: 'center' }}>Stock</div>
            <div className="table-head__cell" />
          </div>

          {items.length === 0 && !loading && (
            <div className="table-empty">No products found.</div>
          )}

          {items.map((p, idx) => (
            <div key={p.id} className="table-row" onClick={() => onView(p.id)}>
              <div className="table-cell" style={{
                color: 'rgba(201,168,76,0.45)',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 11, textAlign: 'center',
              }}>{idx + 1}</div>

              <div className="table-cell" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <img src={p.image} alt={p.name} style={{
                  width: 60, height: 60, objectFit: 'cover',
                  border: '1px solid rgba(201,168,76,0.2)', flexShrink: 0,
                }} onError={e => { e.target.style.display = 'none'; }} />
                <div>
                  <div style={{
                    fontFamily: "'Playfair Display', serif", fontSize: 16,
                    color: '#f0ebe0', letterSpacing: '0.05em', textTransform: 'capitalize',
                  }}>{p.name}</div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: 12,
                    color: '#c9a84c', marginTop: 3, opacity: 0.7,
                  }}>
                    {p.category} · {p.colors?.length ?? 0} color{(p.colors?.length ?? 0) !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="table-cell" style={{
                textAlign: 'center', fontFamily: "'Montserrat', sans-serif", fontSize: 14,
              }}>{p.price} $</div>

              <div className="table-cell" style={{
                textAlign: 'center', fontFamily: "'Montserrat', sans-serif", fontSize: 14,
              }}>{p.stock}</div>

              <div className="table-cell"
                style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}
                onClick={e => e.stopPropagation()}>
                {canWrite && <>
                  <button className="icon-btn icon-btn--edit"
                    onClick={() => onEdit(p.id)} title="Edit">✎</button>
                  <button className="icon-btn icon-btn--delete"
                    onClick={() => onDelete(p.id)} title="Delete">🗑</button>
                </>}
              </div>
            </div>
          ))}

          {/* Sentinel — sits here so the 300px rootMargin fires loadMore
              before the user actually reaches the bottom. */}
          {hasMore && (
            <div ref={sentinelRef} className="table-sentinel">
              {loading ? 'Loading more…' : ''}
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <div className="table-sentinel table-sentinel--end">
              — {total} product{total !== 1 ? 's' : ''} total —
            </div>
          )}
        </div>

        {sideCharts}
      </div>
    </div>
  );
}
