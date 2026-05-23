// ─────────────────────────────────────────────────────────────
// useConnection — single source of truth for "are we online?"
//
// Combines three signals so we don't get fooled when one of them
// lies:
//   1. navigator.onLine    — browser/OS network state
//   2. WebSocket state     — live server reachability
//   3. /api/health probe   — server alive but WS slow to notice
//
// Effective `online` requires the BROWSER to be online AND
// (WebSocket open OR health probe succeeds). Either-or on the
// server side means a brief WS reconnect blip doesn't flap the
// banner — the health probe acts as a stabilising tiebreaker.
//
// The browser is NEVER online when navigator.onLine is false: this
// is a hard floor so we always queue mutations rather than wasting
// fetches that we know will fail.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { apiHealth }           from '../data/api';

const HEALTH_INTERVAL_MS = 8000;

export function useConnection({ realtime } = {}) {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [wsConnected,   setWsConnected]   = useState(false);
  const [serverHealthy, setServerHealthy] = useState(true);

  // ── Browser network events ────────────────────────────────
  useEffect(() => {
    const on  = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ── WS state piped from the realtime client ───────────────
  useEffect(() => {
    if (!realtime) return undefined;
    return realtime.onConnectionChange((connected) => setWsConnected(connected));
  }, [realtime]);

  // ── Periodic health probe ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function probe() {
      const ok = await apiHealth();
      if (!cancelled) setServerHealthy(ok);
    }
    probe();
    const id = setInterval(probe, HEALTH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const online = browserOnline && (wsConnected || serverHealthy);

  return { online, browserOnline, wsConnected, serverHealthy };
}
