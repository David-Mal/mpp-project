// ─────────────────────────────────────────────────────────────
// useInfiniteProducts (Gold)
//
// Manages a growing list of products fetched page-by-page from the
// server. Exposes:
//   items      — accumulated list
//   hasMore    — whether another page exists
//   loading    — fetch in progress
//   total      — server total (for the counter)
//   loadMore() — fetch the next page
//   reload()   — reset to page 1 (used when search/sort changes)
//   merge(p)   — upsert one product (for WS events)
//   remove(id) — remove one product (for WS delete events)
//   prepend(arr) — add items to front (for WS batch events)
//
// Prefetching: the MasterView attaches an IntersectionObserver to a
// sentinel element *above* the last row (300px rootMargin). When the
// sentinel enters the viewport, loadMore() fires before the user
// actually hits the bottom, eliminating the "waiting for next page"
// gap (minimum network usage per the spec).
//
// Search and sort reset the list and re-fetch page 1 whenever they
// change so the server handles filtering (correct even with the
// generator adding items concurrently).
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 8;

export function useInfiniteProducts({ fetchFn, search = '', sort = '', enabled = true }) {
  const [items,   setItems]   = useState([]);
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Cancel stale requests when search/sort changes mid-flight.
  const reqIdRef = useRef(0);

  const fetchPage = useCallback(async (targetPage, replace) => {
    if (!enabled) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn({ page: targetPage, limit: PAGE_SIZE, search, sort });
      if (reqId !== reqIdRef.current) return; // stale — newer request in flight
      const newItems = res.data ?? res.items ?? [];
      const newTotal = res.total ?? 0;
      const newLimit = res.limit ?? PAGE_SIZE;
      const totalPages = Math.max(1, Math.ceil(newTotal / newLimit));
      setItems(prev => {
        if (replace) return newItems;
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...newItems.filter(p => !seen.has(p.id))];
      });
      setPage(targetPage);
      setTotal(newTotal);
      setHasMore(targetPage < totalPages);
    } catch (err) {
      if (reqId === reqIdRef.current) setError(err);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [fetchFn, search, sort, enabled]);

  // Re-fetch from page 1 whenever search/sort/enabled changes.
  useEffect(() => {
    if (!enabled) return;
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
  }, [fetchPage, enabled]); // fetchPage already encodes search+sort

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchPage(page + 1, false);
  }, [loading, hasMore, page, fetchPage]);

  const reload = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
  }, [fetchPage]);

  // ── Local mutators used by the WS event handlers in App.jsx ──
  const merge = useCallback((product) => setItems(prev => {
    const idx = prev.findIndex(p => p.id === product.id);
    if (idx === -1) return [product, ...prev]; // new item: prepend
    const next = [...prev];
    next[idx] = product;
    return next;
  }), []);

  const remove = useCallback((id) =>
    setItems(prev => prev.filter(p => p.id !== id)), []);

  const prepend = useCallback((newItems) => setItems(prev => {
    const seen = new Set(prev.map(p => p.id));
    const fresh = newItems.filter(p => !seen.has(p.id));
    return fresh.length ? [...fresh, ...prev] : prev;
  }), []);

  return { items, hasMore, loading, error, total, loadMore, reload, merge, remove, prepend };
}
