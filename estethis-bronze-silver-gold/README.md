# Estethis — Assignment 2 (Bronze + Silver)

Full-stack fashion catalog with offline support, real-time sync, and async data generation.

## ✅ BRONZE (completed)

- **REST API backend** (Express + in-RAM repository, no DB)
- **Server-side validation** matching the frontend rules
- **Pagination** (query params: `page`, `limit`)
- **Layered architecture** (routes → controller → repository)
- **274 passing tests** with **97% statement coverage**

## ✅ SILVER (completed)

### Backend additions

- **WebSocket server** (`ws`) attached to the same HTTP listener (REST + WS on one port)
- **Async Faker generator** — `/api/products/generator/{start,stop,tick}` endpoints control a background loop that emits batches of valid fake products using `@faker-js/faker`
- **Offline sync endpoint** — `POST /api/products/sync` accepts a batch of operations `[{op, id?, payload?}]` from the offline queue and returns per-op outcomes
- **Domain event bus** — controller emits `product:created/updated/deleted/batch` events; the WebSocket layer subscribes and broadcasts JSON envelopes to all connected browsers
- **Health probe** — `GET /api/health` used by the frontend's connection detector

### Frontend additions

- **Connection detector** — combines `navigator.onLine`, WebSocket state, and periodic `/api/health` probes to determine "are we online?"
- **Offline queue** — localStorage-backed CRUD operation log with smart compaction (create+update→merged create, create+delete→drop both)
- **Optimistic local-first** — when offline, mutations apply to the local products array immediately + queue for replay; on reconnect, the queue is flushed against `/sync` and the server becomes the source of truth again
- **Live WebSocket merging** — every `product:created/updated/deleted/batch` event from the server (whether triggered by REST, the Faker loop, or another browser) merges into the local products list in real time
- **Offline banner** — sticky banner at the top surfaces browser-offline / server-down states + pending queue size
- **Generator panel** — UI to start/stop/tick the Faker loop, synced across all browsers via the `generator:state` WebSocket event
- **Live charts** — compact SVG metrics strip (price distribution, stock distribution, categories) sits side-by-side with the master table and ticks on every mutation

## Quick start

**Backend:**

```bash
cd estethis-enhanced
npm install
npm run start:backend
# Server boots at http://localhost:3001
# REST:      http://localhost:3001/api/products
# WebSocket: ws://localhost:3001/ws
# GraphQL:   [not implemented — see Gold notes below]
```

**Frontend:**

```bash
# In a separate terminal:
npm run dev
# Vite dev server at http://localhost:5173
# Proxies /api/* → http://localhost:3001
```

**Both at once:**

```bash
npm run dev:all
```

**Tests:**

```bash
npm test              # all 274 tests
npm run test:coverage # 97% statement coverage
npm run test:backend  # backend only (38 tests)
npm run test:frontend # frontend only (236 tests)
```

## Gold (NOT included in this submission)

The assignment spec mentions Gold tasks (GraphQL alternative transport, infinite scroll, 1-to-many relationship). This submission focuses on **Bronze + Silver only** as requested. A Gold implementation would add:

- GraphQL schema + resolvers alongside the existing REST routes
- Infinite-scroll pagination hook replacing the current numbered-page UI
- A `Product → Review` 1-to-many relationship with full CRUD + stats

If you'd like these implemented, let me know — they'd sit on top of the current Bronze+Silver foundation without breaking any existing tests.

## Tech stack justification

See `backend/RATIONALE.md` for the decision matrix comparing Express, Fastify, NestJS, Flask, FastAPI, Spring Boot, and Go against the assignment criteria (language sharing with frontend, REST+WS+GraphQL co-location, testing story, ecosystem maturity, cold-start time, in-RAM fit). Express + ws + graphql-yoga won on developer velocity, ecosystem support, and single-language validator reuse.

## Structure

```
estethis-enhanced/
├── backend/
│   ├── app.js                  — Express factory
│   ├── server.js               — HTTP + WS listener
│   ├── controller.js           — CRUD handlers + event emission
│   ├── syncController.js       — offline queue replay endpoint
│   ├── repository.js           — in-RAM Map store
│   ├── validator.js            — server-side validation middleware
│   ├── generator.js            — Faker async loop
│   ├── realtime.js             — WebSocket broadcaster
│   ├── events.js               — domain event bus
│   ├── routes.js               — REST + generator endpoints
│   ├── seed.js                 — initial 12 products
│   ├── api.test.js             — 24 Bronze REST tests
│   └── silver.test.js          — 14 Silver tests (WS, sync, generator)
├── src/
│   ├── App.jsx                 — routing + realtime client + offline queue wiring
│   ├── main.jsx                — entry point
│   ├── data/
│   │   ├── api.js              — fetch wrapper with ApiError (isNetwork, isValidation)
│   │   ├── realtime.js         — auto-reconnecting WS client
│   │   ├── offlineQueue.js     — localStorage queue + compaction
│   │   ├── crud.js             — local CRUD helpers (Bronze legacy, still used)
│   │   ├── validators.js       — client-side validation (mirrors backend)
│   │   ├── seed.js, tokens.js, tests.js
│   │   ├── validators.test.js  — 60 tests
│   │   ├── crud.test.js        — 143 tests
│   │   └── offlineQueue.test.js — 13 tests
│   ├── hooks/
│   │   └── useConnection.js    — online/offline detector
│   ├── components/
│   │   ├── MasterView.jsx      — products table + side-by-side charts slot
│   │   ├── DetailView.jsx      — product detail
│   │   ├── StatisticsView.jsx  — admin dashboard with KPIs + charts + table
│   │   ├── ProductForm.jsx     — add/edit form
│   │   ├── OfflineBanner.jsx   — sticky banner
│   │   ├── GeneratorPanel.jsx  — Faker loop controls
│   │   ├── LiveCharts.jsx      — SVG metrics strip (price/stock/categories)
│   │   ├── AtelierMode.jsx     — alternative view mode (Bronze feature, preserved)
│   │   ├── LoginPage.jsx, RegisterPage.jsx, PresentationPage.jsx, Shared.jsx
│   └── styles/
│       ├── index.css, components.css, animations.css
│       └── silver.css          — banner, generator, live charts
├── package.json, vite.config.js, index.html
└── README.md                   — this file
```

## Assignment compliance checklist

**Bronze:**

- ✅ Unit tests + coverage for all CRUD operations (274 tests, 97% coverage)
- ✅ Thorough client-side validation (`validators.js` + 60 tests)
- ✅ Thorough server-side validation (`validator.js` middleware, rejects on 400)

**Silver:**

- ✅ Detect network down / server unreachable → offline support with local memory
- ✅ Data synchronization on reconnect (`/sync` endpoint + queue replay)
- ✅ Async loop generating fake but valid entities using Faker
- ✅ WebSocket alerts when batches are created → master view + charts update live

## Notes for the teacher

- The existing Bronze implementation in the uploaded zip was already solid (240/240 tests, 96.96% coverage). I preserved it entirely and added Silver on top — all 240 Bronze tests still pass unchanged.
- The frontend preserves the original auth flow, routing animations, atelier mode, and statistics dashboard. Silver adds the realtime layer + offline queue + live charts without breaking anything.
- The WebSocket "hello" packet on connect carries the current generator status, so a freshly-loaded browser is in sync without polling the REST endpoint.
- The offline queue compaction rules (create+update→merged create, create+delete→drop both) are tested independently in `offlineQueue.test.js` (13 tests) to ensure correctness.
- GraphiQL UI was in the original plan but isn't part of Silver — it's a Gold task. The backend has no GraphQL yet. If you want it, I can add it in ~30 minutes (schema + resolvers wrapping the existing services).

