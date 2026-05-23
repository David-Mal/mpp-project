// ─────────────────────────────────────────────────────────────
// OBSERVATION LIST VIEW — Step 4 (Gold)
//
// Admin-only dashboard showing flagged users and the threat rule
// that triggered each entry. Admin can:
//   • Toggle between active and all (including resolved) threats
//   • Resolve an entry to clear it from the active list
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { apiObservationList, apiResolveObservation } from '../data/api';

const REASON_META = {
  HIGH_FREQUENCY: {
    label: 'High-Frequency Flooding',
    desc:  '≥ 20 actions in 60 s',
    color: '#e06c75',
  },
  MASS_DELETION: {
    label: 'Mass Deletion',
    desc:  '≥ 3 deletions in 5 min',
    color: '#d19a66',
  },
  UNAUTHORIZED_ADMIN_PROBE: {
    label: 'Admin Endpoint Probing',
    desc:  '≥ 3 unauthorized admin hits',
    color: '#c678dd',
  },
};

function RuleLegend() {
  return (
    <div className="obs-legend">
      <span className="obs-legend-title">DETECTION RULES</span>
      {Object.values(REASON_META).map(r => (
        <span key={r.label} className="obs-legend-rule" style={{ borderColor: r.color }}>
          <span className="obs-legend-dot" style={{ background: r.color }} />
          {r.label} — {r.desc}
        </span>
      ))}
    </div>
  );
}

export default function ObservationListView({ onBack }) {
  const [entries,      setEntries]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [resolving,    setResolving]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiObservationList(showResolved);
      setEntries(data);
    } catch (err) {
      setError(err.message || 'Failed to load observation list.');
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id) => {
    setResolving(id);
    try {
      await apiResolveObservation(id);
      // Remove from active view, or refresh resolved flag
      if (!showResolved) {
        setEntries(prev => prev.filter(e => e.id !== id));
      } else {
        setEntries(prev =>
          prev.map(e => e.id === id ? { ...e, resolvedAt: new Date().toISOString() } : e)
        );
      }
    } catch (err) {
      alert(err.message || 'Could not resolve entry.');
    } finally {
      setResolving(null);
    }
  };

  const active   = entries.filter(e => !e.resolvedAt).length;
  const resolved = entries.filter(e =>  e.resolvedAt).length;

  return (
    <div className="stats-page page-enter">

      {/* Header */}
      <header className="stats-header" style={{ borderBottom: '1px solid rgba(201,168,76,0.15)', paddingBottom: 16 }}>
        <button className="form-back-btn" onClick={onBack}>← BACK</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 className="stats-heading" style={{ fontSize: 26, marginBottom: 4 }}>
            OBSERVATION LIST
          </h2>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'rgba(201,168,76,0.6)', letterSpacing: '0.1em' }}>
            THREAT DETECTION DASHBOARD
          </p>
        </div>

        {/* Counters */}
        <div className="obs-counters">
          <div className="obs-counter obs-counter--danger">
            <span className="obs-counter-num">{active}</span>
            <span className="obs-counter-lbl">ACTIVE</span>
          </div>
          <div className="obs-counter obs-counter--ok">
            <span className="obs-counter-num">{resolved}</span>
            <span className="obs-counter-lbl">RESOLVED</span>
          </div>
        </div>
      </header>

      {/* Legend + filter toggle */}
      <div className="obs-toolbar">
        <RuleLegend />
        <label className="obs-toggle">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={e => setShowResolved(e.target.checked)}
          />
          <span>Show resolved</span>
        </label>
        <button className="stats-btn" onClick={load} style={{ marginLeft: 'auto', fontSize: 11 }}>
          ↻ REFRESH
        </button>
      </div>

      {/* Body */}
      <div className="stats-body" style={{ padding: '1.5rem 2rem' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: '#aaa', padding: '2rem 0' }}>Loading…</p>
        )}
        {error && (
          <p style={{ textAlign: 'center', color: '#e06c75', padding: '2rem 0' }}>{error}</p>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="obs-empty">
            <span style={{ fontSize: 32 }}>✓</span>
            <p>No {showResolved ? '' : 'active '}threats detected.</p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <table className="obs-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Threat</th>
                <th>Details</th>
                <th>First Detected</th>
                <th>Last Updated</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const meta    = REASON_META[e.reason] ?? { label: e.reason, color: '#888', desc: '' };
                const isActive = !e.resolvedAt;
                return (
                  <tr key={e.id} className={isActive ? 'obs-row--active' : 'obs-row--resolved'}>
                    <td className="obs-cell-email">{e.userEmail ?? `#${e.userId}`}</td>
                    <td>
                      <span className="obs-threat-badge" style={{ borderColor: meta.color, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="obs-cell-details">{e.details}</td>
                    <td className="obs-cell-time">
                      {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="obs-cell-time">
                      {e.updatedAt ? new Date(e.updatedAt).toLocaleString() : '—'}
                    </td>
                    <td>
                      {isActive
                        ? <span className="obs-status obs-status--active">⚠ ACTIVE</span>
                        : <span className="obs-status obs-status--resolved">✓ RESOLVED</span>}
                    </td>
                    <td>
                      {isActive && (
                        <button
                          className="obs-resolve-btn"
                          onClick={() => handleResolve(e.id)}
                          disabled={resolving === e.id}
                        >
                          {resolving === e.id ? '…' : 'RESOLVE'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
