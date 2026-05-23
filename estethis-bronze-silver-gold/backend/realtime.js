// ─────────────────────────────────────────────────────────────
// REALTIME — WebSocket broadcaster + chat hub
//
// Outbound (server → client):
//   Product/generator events are broadcast to every open socket.
//   Chat messages are broadcast only to sockets in the same room.
//
// Inbound (client → server) — chat protocol:
//   { type: 'chat:auth',    token }             → authenticate socket
//   { type: 'chat:join',    roomId }            → join room, get history
//   { type: 'chat:message', content }           → send message to room
// ─────────────────────────────────────────────────────────────

import { WebSocketServer } from 'ws';
import { events, EVENTS }  from './events.js';
import * as generator      from './generator.js';
import { getSession }      from './session.js';
import * as chatRepo       from './chat/chatRepo.js';

// Origins allowed to open a WebSocket connection.
// In production set WS_ALLOWED_ORIGINS=https://your-domain.com
const ALLOWED_ORIGINS = process.env.WS_ALLOWED_ORIGINS
  ? process.env.WS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null; // null = allow all (dev default)

function allowedOrigin(origin) {
  if (!ALLOWED_ORIGINS) return true;   // dev: no restriction
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(o => origin.startsWith(o));
}

export function attach({ httpServer, path = '/ws' }) {
  const wss = new WebSocketServer({
    server: httpServer,
    path,
    verifyClient({ origin }, cb) {
      if (allowedOrigin(origin)) { cb(true); return; }
      console.warn(`[ws] rejected connection from origin: ${origin}`);
      cb(false, 403, 'Forbidden');
    },
  });

  // socket → { user: {id,email,role,...} | null, roomId: string }
  const socketMeta = new Map();

  // ── Helpers ────────────────────────────────────────────────

  function send(socket, type, data) {
    if (socket.readyState !== socket.OPEN) return;
    try { socket.send(JSON.stringify({ type, data, ts: Date.now() })); } catch { /* gone */ }
  }

  function broadcast(type, data) {
    const msg = JSON.stringify({ type, data, ts: Date.now() });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        try { client.send(msg); } catch { /* gone */ }
      }
    }
  }

  function broadcastToRoom(roomId, type, data) {
    const msg = JSON.stringify({ type, data, ts: Date.now() });
    for (const [sock, meta] of socketMeta.entries()) {
      if (meta.roomId === roomId && sock.readyState === sock.OPEN) {
        try { sock.send(msg); } catch { /* gone */ }
      }
    }
  }

  function broadcastOnline(roomId) {
    const online = [];
    for (const [, meta] of socketMeta.entries()) {
      if (meta.roomId === roomId && meta.user) {
        // deduplicate by userId (same user can have multiple tabs)
        if (!online.find(u => u.userId === meta.user.id)) {
          online.push({ userId: meta.user.id, userEmail: meta.user.email });
        }
      }
    }
    broadcastToRoom(roomId, 'chat:online', online);
  }

  // ── Product event subscriptions ─────────────────────────────
  const subs = [
    [EVENTS.PRODUCT_CREATED, (p)   => broadcast('product:created', p)],
    [EVENTS.PRODUCT_UPDATED, (p)   => broadcast('product:updated', p)],
    [EVENTS.PRODUCT_DELETED, (i)   => broadcast('product:deleted', i)],
    [EVENTS.PRODUCT_BATCH,   (arr) => broadcast('product:batch',   arr)],
    [EVENTS.GENERATOR_STATE, (st)  => broadcast('generator:state', st)],
  ];
  for (const [evt, fn] of subs) events.on(evt, fn);

  // ── WebSocket connection handler ────────────────────────────
  wss.on('connection', (socket) => {
    socketMeta.set(socket, { user: null, roomId: 'general' });

    // Hello packet — sync generator status immediately.
    send(socket, 'hello', { generator: generator.status() });

    socket.on('error', () => {
      try { socket.close(); } catch { /* already closed */ }
    });

    socket.on('close', () => {
      const meta = socketMeta.get(socket);
      socketMeta.delete(socket);
      if (meta?.roomId) broadcastOnline(meta.roomId);
    });

    socket.on('message', async (rawData) => {
      let msg;
      try { msg = JSON.parse(rawData.toString()); } catch { return; }

      const meta = socketMeta.get(socket) || { user: null, roomId: 'general' };

      // ── chat:auth ─────────────────────────────────────────
      if (msg.type === 'chat:auth') {
        const user = msg.token ? getSession(msg.token) : null;
        socketMeta.set(socket, { ...meta, user });
        return;
      }

      // ── chat:join ─────────────────────────────────────────
      if (msg.type === 'chat:join') {
        const oldRoom = meta.roomId;
        const roomId  = (msg.roomId || 'general').slice(0, 50);
        socketMeta.set(socket, { ...meta, roomId });
        // Send history for the new room.
        const history = await chatRepo.getHistory(roomId, 50);
        send(socket, 'chat:history', history);
        broadcastOnline(roomId);
        if (oldRoom !== roomId) broadcastOnline(oldRoom);
        return;
      }

      // ── chat:message ──────────────────────────────────────
      if (msg.type === 'chat:message') {
        if (!meta.user) {
          send(socket, 'chat:error', { message: 'Not authenticated' });
          return;
        }
        const content = (msg.content || '').trim().slice(0, 1000);
        if (!content) return;

        const saved = await chatRepo.saveMessage({
          userId:    meta.user.id,
          userEmail: meta.user.email,
          userRole:  meta.user.role,
          content,
          roomId:    meta.roomId || 'general',
        });
        broadcastToRoom(meta.roomId || 'general', 'chat:message', saved);
      }
    });
  });

  function close() {
    for (const [evt, fn] of subs) events.off(evt, fn);
    return new Promise((resolve) => wss.close(() => resolve()));
  }

  return { wss, broadcast, close };
}
