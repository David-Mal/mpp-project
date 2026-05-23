import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiActionLogs } from '../data/api';

function formatTs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function ActionLogsView({ onBack }) {
  const [rows,       setRows]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [rawSearch,  setRawSearch]  = useState('');
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortCol,    setSortCol]    = useState('createdAt');
  const [sortDir,    setSortDir]    = useState('desc');

  // Debounce raw input → committed search (resets to page 1)
  useEffect(() => {
    const id = setTimeout(() => { setSearch(rawSearch); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [rawSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiActionLogs({
        page,
        limit: 50,
        ...(search     ? { search }              : {}),
        ...(roleFilter ? { groupId: roleFilter } : {}),
      });
      setRows(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      setError(err.message || 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  function handleRoleChange(val) { setRoleFilter(val); setPage(1); }

  function handleSortCol(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const sorted = useMemo(() => {
    const cmp = (a, b) => {
      switch (sortCol) {
        case 'createdAt':  return new Date(a.createdAt) - new Date(b.createdAt);
        case 'userId':     return a.userId - b.userId;
        case 'groupId':    return (a.groupId ?? '').localeCompare(b.groupId ?? '');
        case 'actionInfo': return (a.actionInfo ?? '').localeCompare(b.actionInfo ?? '');
        default:           return 0;
      }
    };
    return [...rows].sort((a, b) => sortDir === 'asc' ? cmp(a, b) : -cmp(a, b));
  }, [rows, sortCol, sortDir]);

  const from = total === 0 ? 0 : (page - 1) * 50 + 1;
  const to   = Math.min(page * 50, total);

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="alog-sort-icon alog-sort-icon--inactive">⇅</span>;
    return <span className="alog-sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="stats-page page-enter">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="stats-header" style={{ borderBottom: '1px solid rgba(201,168,76,0.15)', paddingBottom: 16 }}>
        <button className="form-back-btn" onClick={onBack}>← BACK</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 className="stats-heading" style={{ fontSize: 26, marginBottom: 4 }}>SYSTEM LOGS</h2>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'rgba(201,168,76,0.6)', letterSpacing: '0.1em' }}>
            ACTION AUDIT TRAIL
          </p>
        </div>
        <div className="obs-counters">
          <div className="obs-counter obs-counter--ok">
            <span className="obs-counter-num">{total}</span>
            <span className="obs-counter-lbl">TOTAL</span>
          </div>
        </div>
      </header>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="obs-toolbar">
        <input
          className="alog-search"
          type="text"
          placeholder="Filter by action details…"
          value={rawSearch}
          onChange={e => setRawSearch(e.target.value)}
        />
        <select
          className="alog-filter-select"
          value={roleFilter}
          onChange={e => handleRoleChange(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="admin">admin</option>
          <option value="user">user</option>
        </select>
        {total > 0 && (
          <span className="alog-count">{from}–{to} of {total}</span>
        )}
        <button
          className="stats-btn"
          onClick={load}
          style={{ marginLeft: 'auto', fontSize: 11 }}
        >↻ REFRESH</button>
      </div>

      {/* ── Table body ──────────────────────────────────────────── */}
      <div className="stats-body" style={{ padding: '1.5rem 2rem' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: '#aaa', padding: '2rem 0' }}>Loading…</p>
        )}
        {error && (
          <p style={{ textAlign: 'center', color: '#e06c75', padding: '2rem 0' }}>{error}</p>
        )}
        {!loading && !error && sorted.length === 0 && (
          <div className="obs-empty">
            <span style={{ fontSize: 32 }}>○</span>
            <p>No log entries{rawSearch ? ` matching "${rawSearch}"` : ''}.</p>
          </div>
        )}
        {!loading && !error && sorted.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="obs-table">
              <thead>
                <tr>
                  <th className="alog-th--sortable" onClick={() => handleSortCol('createdAt')}>
                    TIMESTAMP <SortIcon col="createdAt" />
                  </th>
                  <th className="alog-th--sortable" onClick={() => handleSortCol('userId')}>
                    USER <SortIcon col="userId" />
                  </th>
                  <th className="alog-th--sortable" onClick={() => handleSortCol('groupId')}>
                    ROLE <SortIcon col="groupId" />
                  </th>
                  <th className="alog-th--sortable" onClick={() => handleSortCol('actionInfo')}>
                    ACTION DETAILS <SortIcon col="actionInfo" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => (
                  <tr key={row.id}>
                    <td className="alog-ts">{formatTs(row.createdAt)}</td>
                    <td className="obs-cell-email">
                      {row.userEmail ?? `#${row.userId}`}
                      <span className="alog-uid"> #{row.userId}</span>
                    </td>
                    <td>
                      <span className={`alog-role-badge alog-role-badge--${row.groupId}`}>
                        {row.groupId}
                      </span>
                    </td>
                    <td className="alog-action">{row.actionInfo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="alog-pagination">
          <button
            className="alog-page-btn"
            onClick={() => setPage(p => p - 1)}
            disabled={page <= 1 || loading}
          >← PREV</button>
          <span className="alog-page-info">PAGE {page} / {pages}</span>
          <button
            className="alog-page-btn"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= pages || loading}
          >NEXT →</button>
        </div>
      )}
    </div>
  );
}
