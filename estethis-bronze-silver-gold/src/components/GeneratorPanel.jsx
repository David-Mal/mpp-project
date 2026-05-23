// ─────────────────────────────────────────────────────────────
// GENERATOR PANEL (Silver)
// UI to drive the server-side async fake-data generator.
// Reflects state from BOTH the REST status endpoint (on mount) and
// the "generator:state" WebSocket broadcast (so multiple browsers
// stay in sync if one of them flips the switch).
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { generatorApi }        from '../data/api';

export default function GeneratorPanel({ realtime, online }) {
  const [status,     setStatus]     = useState({ running: false, intervalMs: 2000, batchSize: 3, totalGenerated: 0 });
  const [intervalMs, setIntervalMs] = useState(2000);
  const [batchSize,  setBatchSize]  = useState(3);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState(null);

  // Initial status fetch (when we're online).
  useEffect(() => {
    if (!online) return;
    generatorApi.status().then(setStatus).catch(() => {});
  }, [online]);

  // Live state updates from WS.
  useEffect(() => {
    if (!realtime) return undefined;
    const off1 = realtime.subscribe('generator:state', (s) => {
      setStatus(s);
      // Don't yank the user's form values away while the loop is
      // running; only sync inputs when stopped.
      if (!s.running) {
        setIntervalMs(s.intervalMs ?? 2000);
        setBatchSize(s.batchSize  ?? 3);
      }
    });
    // The "hello" frame on connect carries the current generator state.
    const off2 = realtime.subscribe('hello', (data) => {
      if (data?.generator) setStatus(data.generator);
    });
    return () => { off1?.(); off2?.(); };
  }, [realtime]);

  async function start() {
    setBusy(true); setError(null);
    try {
      const s = await generatorApi.start({ intervalMs: Number(intervalMs), batchSize: Number(batchSize) });
      setStatus(s);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function stop() {
    setBusy(true); setError(null);
    try {
      const s = await generatorApi.stop();
      setStatus(s);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function tick() {
    setBusy(true); setError(null);
    try { await generatorApi.tick({ batchSize: Number(batchSize) }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const disabled = !online || busy;

  return (
    <section className="genpanel">
      <header className="genpanel__header">
        <span className="genpanel__eyebrow">FAKE-DATA GENERATOR</span>
        <span className={`genpanel__pill genpanel__pill--${status.running ? 'on' : 'off'}`}>
          {status.running ? '● RUNNING' : '○ STOPPED'}
        </span>
      </header>

      <div className="genpanel__row">
        <label className="genpanel__field">
          <span>INTERVAL (ms)</span>
          <input
            type="number" min="250" step="250"
            value={intervalMs}
            onChange={(e) => setIntervalMs(e.target.value)}
            disabled={status.running || disabled}
          />
        </label>
        <label className="genpanel__field">
          <span>BATCH SIZE</span>
          <input
            type="number" min="1" max="20"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
            disabled={status.running || disabled}
          />
        </label>
        <div className="genpanel__actions">
          {!status.running ? (
            <button className="genpanel__btn genpanel__btn--primary" disabled={disabled} onClick={start}>START</button>
          ) : (
            <button className="genpanel__btn genpanel__btn--danger"  disabled={disabled} onClick={stop}>STOP</button>
          )}
          <button className="genpanel__btn genpanel__btn--ghost" disabled={disabled} onClick={tick}>TICK ONCE</button>
        </div>
      </div>

      <div className="genpanel__meta">
        <span>Generated this session: <strong>{status.totalGenerated ?? 0}</strong></span>
        {error && <span className="genpanel__error">{error}</span>}
        {!online && <span className="genpanel__error">— offline, controls disabled</span>}
      </div>
    </section>
  );
}
