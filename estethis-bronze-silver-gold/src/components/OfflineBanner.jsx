// ─────────────────────────────────────────────────────────────
// OFFLINE BANNER
// Sticky banner at the top of the screen. Surfaces:
//   - browser-offline state
//   - server-down state (browser online, server unreachable)
//   - pending offline-queue size
//   - sync in progress
// Hidden when everything is healthy and the queue is empty.
// ─────────────────────────────────────────────────────────────

export default function OfflineBanner({
  browserOnline, wsConnected, serverHealthy, queueSize, syncing,
}) {
  const browserOff = !browserOnline;
  const serverOff  = browserOnline && !wsConnected && !serverHealthy;
  const visible    = browserOff || serverOff || queueSize > 0 || syncing;
  if (!visible) return null;

  let mode    = 'warn';
  let message = '';
  if (browserOff) {
    mode = 'danger';
    message = `You're offline. Changes are saved locally${queueSize > 0 ? ` (${queueSize} pending)` : ''}.`;
  } else if (serverOff) {
    mode = 'danger';
    message = `Server unreachable. Working in offline mode${queueSize > 0 ? ` — ${queueSize} pending` : ''}.`;
  } else if (syncing) {
    mode = 'info';
    message = `Syncing ${queueSize || ''} pending change${queueSize === 1 ? '' : 's'}…`;
  } else if (queueSize > 0) {
    mode = 'warn';
    message = `${queueSize} change${queueSize === 1 ? '' : 's'} queued for sync.`;
  }

  return (
    <div className={`offline-banner offline-banner--${mode}`} role="status" aria-live="polite">
      <span className="offline-banner__dot" />
      <span className="offline-banner__msg">{message}</span>
    </div>
  );
}
