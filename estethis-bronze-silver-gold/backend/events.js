// ─────────────────────────────────────────────────────────────
// EVENTS — Domain event bus (Silver)
//
// A single EventEmitter shared across modules so that the controller
// and the generator can announce changes ("product:created",
// "product:batch", …) without importing the WebSocket layer
// directly. The realtime module subscribes here and broadcasts to
// connected browsers.
//
// Rationale: keeps the dependency direction one-way
// (controller → emitter ← realtime). Easy to test — just listen on
// the bus and assert.
// ─────────────────────────────────────────────────────────────

import { EventEmitter } from 'node:events';

export const events = new EventEmitter();
events.setMaxListeners(50);

// Canonical event names — typo guard.
export const EVENTS = Object.freeze({
  PRODUCT_CREATED: 'product:created',
  PRODUCT_UPDATED: 'product:updated',
  PRODUCT_DELETED: 'product:deleted',
  PRODUCT_BATCH:   'product:batch',     // emitted by the generator loop
  GENERATOR_STATE: 'generator:state',   // running / stopped
  CHAT_MESSAGE:    'chat:message',      // real-time chat (Step 2)
});
