// ─────────────────────────────────────────────────────────────
// REALTIME.JS — Frontend WebSocket client (Silver)
//
// Auto-reconnecting WebSocket with exponential backoff and a
// pub/sub interface for components:
//
//     const rt = createRealtimeClient();
//     const off = rt.subscribe('product:created', (data) => …);
//     rt.onConnectionChange((connected) => …);
//     rt.close();
//
// Both /api and /ws are proxied through Vite's dev server to the
// backend. Using the page's own origin for /ws means all traffic
// goes through port 5173, which is always reachable on the LAN
// without needing a separate firewall rule for port 3001.
// ─────────────────────────────────────────────────────────────

function resolveWsUrl() {
  const { protocol, hostname, port } = window.location;
  const wsProto    = protocol === 'https:' ? 'wss:' : 'ws:';
  const portSuffix = port ? `:${port}` : '';
  return `${wsProto}//${hostname}${portSuffix}/ws`;
}

export function createRealtimeClient() {
  /** @type {WebSocket | null} */
  let socket = null;
  let backoff = 500;
  let alive = true;
  let reconnectTimer = null;
  let currentlyConnected = false;

  /** @type {Map<string, Set<Function>>} */
  const handlers = new Map();
  /** @type {Set<Function>} */
  const statusListeners = new Set();

  function notify(connected) {
    currentlyConnected = connected;
    for (const fn of statusListeners) {
      try { fn(connected); } catch { /* ignore listener errors */ }
    }
  }

  function dispatch(type, data) {
    const set = handlers.get(type);
    if (!set) return;
    for (const fn of set) {
      try { fn(data); } catch (err) { console.error(`[ws ${type}]`, err); }
    }
  }

  function connect() {
    if (!alive) return;

    let url;
    try { url = resolveWsUrl(); } catch { return; }

    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.addEventListener('open', () => {
      backoff = 500;
      notify(true);
    });
    socket.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg && typeof msg.type === 'string') dispatch(msg.type, msg.data);
    });
    socket.addEventListener('close', () => {
      notify(false);
      scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      // close handler will run shortly after — let it manage reconnect.
      try { socket.close(); } catch { /* may already be closed */ }
    });
  }

  function scheduleReconnect() {
    if (!alive || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      backoff = Math.min(backoff * 2, 10_000); // cap at 10 s
      connect();
    }, backoff);
  }

  function subscribe(type, handler) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(handler);
    return () => handlers.get(type)?.delete(handler);
  }

  function onConnectionChange(listener) {
    statusListeners.add(listener);
    // Replay current state immediately so late subscribers never miss it.
    try { listener(currentlyConnected); } catch { /* ignore */ }
    return () => statusListeners.delete(listener);
  }

  function send(msg) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try { socket.send(JSON.stringify(msg)); } catch { /* gone */ }
    }
  }

  function close() {
    alive = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) { try { socket.close(); } catch { /* already closed */ } }
  }

  // Auto-start.
  connect();

  return { subscribe, onConnectionChange, send, close };
}
