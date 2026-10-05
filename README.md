# Estethis — Luxury Fashion E-Commerce Platform

App Link: [https://mpp-project-z3qj.onrender.com](https://mpp-project-z3qj.onrender.com)

Full-stack web application for browsing, purchasing, and managing a high-end fashion catalogue. The UI uses a dark/gold aesthetic. The stack combines **React 19**, **Vite**, **Express 5**, **Sequelize**, and **SQLite** (with optional PostgreSQL), plus **WebSockets** for live updates and a client-side **offline queue** for resilient catalog management.

---

## Highlights


| Area                     | What it does                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **E-commerce**           | Shopping cart, checkout (simulated payment), order history, site footer (About / Contact / Terms)                |
| **Gamification**         | Post-checkout **Ticket Machine** (random coupon win) and **My Coupons** with checkout redemption                 |
| **Guest mode**           | Browse catalog and product details without an account; protected actions open a sign-in modal                    |
| **RBAC**                 | `admin`, `manager`, and `user` roles with permission strings enforced on API routes and in the UI                |
| **Atelier**              | 3-step bespoke tailoring configurator (SVG body map, validated measurements) for all logged-in users             |
| **Admin**                | Statistics, product CRUD, **Orders** tab, **Inbox** for contact messages, users, action logs, threat observation |
| **Realtime & offline**   | WebSocket product sync, offline CRUD queue with compaction, optimistic UI, connection banner                     |
| **Gold tier**            | Infinite-scroll catalog, product **reviews** (1-to-many), **GraphQL** at `/graphql`                              |
| **Persistence (client)** | User-scoped cart in `localStorage`, global orders/coupons/messages, cookie-based category tracking               |


---

## Tech stack

**Frontend:** React 19, Vite 8, CSS modules / theme styles, Vitest  
**Backend:** Express 5, Sequelize ORM, SQLite (default) or PostgreSQL via `DATABASE_URL`  
**Realtime:** `ws` WebSocket on the same port as HTTP(S)  
**Auth:** Session token (`X-Session-Token`), bcrypt passwords, OTP and magic-link flows (demo-friendly)  
**Optional:** MongoDB for chat history (falls back to in-memory if unavailable)  
**API:** REST (`/api/products`, `/api/auth`, `/api/admin`, reviews), GraphQL (Gold)

---

## Quick start

From the project root (`estethis-bronze-silver-gold`):

```bash
npm install
cp .env.example .env    # optional; SQLite works out of the box
npm run migrate         # Sequelize migrations → estethis.sqlite3
```

**Run backend + frontend together:**

```bash
npm run dev:all
```

- **Frontend (Vite):** [http://localhost:5173](http://localhost:5173) — proxies `/api`, `/ws`, `/graphql` to the backend  
- **Backend:** [http://localhost:3001](http://localhost:3001) (or HTTPS on 3443 if TLS certs exist in `certs/`)

**Run separately:**

```bash
npm run start:backend   # Express + WebSocket + GraphQL
npm run dev             # Vite only
```

**Production build:**

```bash
npm run build
npm run preview
```

---

## Demo accounts

Seeded on first startup (`backend/authSeed.js`):


| Role    | Email                  | Password     |
| ------- | ---------------------- | ------------ |
| Admin   | `admin@estethis.com`   | `admin123`   |
| Manager | `manager@estethis.com` | `manager123` |
| User    | `user@estethis.com`    | `user123`    |


---

## Roles and permissions

Permissions are stored in the database and attached to the session user object.


| Permission                       | User | Manager | Admin |
| -------------------------------- | ---- | ------- | ----- |
| `products:read`                  | ✓    | ✓       | ✓     |
| `products:write`                 |      | ✓       | ✓     |
| `reviews:read` / `reviews:write` | ✓    | ✓       | ✓     |
| `stats:read`                     | ✓    | ✓       | ✓     |
| `generator:manage`               |      | ✓       | ✓     |
| `users:read`                     |      | ✓       | ✓     |
| `users:manage`                   |      |         | ✓     |


**UI behaviour (examples):**

- **User:** shop, reviews, Atelier, cart, checkout, order history, coupons; no product edit/delete in catalog admin UI  
- **Manager:** product CRUD, statistics, generator panel, Atelier; sees users list but cannot manage accounts  
- **Admin:** full admin panel, Users / Logs / Threats, contact **Inbox**; contact form hidden (directed to Inbox)

**Guest:** `authStage === 'guest'` — full product list and detail (including reviews); cart, checkout, and account actions show `GuestAuthModal`. Product **GET** routes are public; writes still require auth.

---

## User-facing features

### Catalog and product detail

- Infinite scroll with search and sort (`useInfiniteProducts`, IntersectionObserver prefetch)  
- Product detail: colors/sizes, reviews panel, add to cart (authenticated)  
- Live charts beside the master table (price/stock/category snapshots)

### Cart and checkout

- Slide-over **CartDrawer**, quantity updates, persisted per user (`estethis_cart_u{userId}`)  
- **CheckoutPage:** shipping + simulated card payment, order summary  
- **Promo code:** enter coupon from Ticket Machine (`EST10OFF`, `EST15USD`, `ESTBOGO1`); validates owner, expiry, and single use; discount applied to total; coupon marked `used` on place order

### Ticket Machine and coupons

- After checkout → **TicketMachinePage** (~5% win chance; CSS reel animation)  
- Won coupons saved to global storage with `userId`, 30-day expiry  
- **My Account → My Coupons:** status (Available / Used / Expired), copy code

### Atelier (bespoke tailoring)

- Available to any **logged-in** user (not guest)  
- Steps: select product → SVG measurement points with min/max validation → confirm & send (client-side request flow)

### Static pages and contact

- Footer links: About Us, Contact, Terms  
- Contact form persists messages for admin **Inbox** (admins see a notice instead of the form)

---

## Admin and operations

### Statistics view (`StatisticsView`)

- Visual KPIs (catalog + **Total Revenue** / **Orders Placed** from client-side order store)  
- Tabular product list with edit/delete when `products:write`  
- **Orders** tab: expandable order cards (all users’ orders in local persistence)  
- **Inbox** tab (admin): contact messages, unread badge, mark as read

### Silver / Gold tooling

- **Generator panel** (`generator:manage`): Faker-driven product batches, synced via WebSocket  
- **Offline banner:** browser online, WS connected, server health, queue size  
- **Chat panel** (logged-in users): realtime chat via WebSocket (+ optional MongoDB history)  
- **Action logs** and **observation / threat** views (admin)

---

## Architecture notes

### Frontend routing

Single-page app: `view` state in `App.jsx` (`landing`, `master`, `detail`, `checkout`, `thankyou`, `orderHistory`, `stats`, `atelier`, static pages, admin views). No React Router — props carry handlers and global state (cart, orders, coupons, messages, auth).

### Client persistence (`src/data/storage.js`)


| Storage                      | Keys / usage                                           |
| ---------------------------- | ------------------------------------------------------ |
| `localStorage` (user-scoped) | Cart: `estethis_cart_u{userId}`                        |
| `localStorage` (global)      | Orders, coupons, contact messages, offline CRUD queue  |
| Cookies (`est_`*)            | Last page, recent categories (personalization banner)  |
| Session token                | `estethis_token` in `localStorage` (`src/data/api.js`) |


Session restore: `apiMe()` on load reloads the user’s cart. Logout saves cart then clears activity cookies.

### Connection and offline (`useConnection`, `offlineQueue.js`)

Effective **online** = browser online **and** (WebSocket connected **or** `/api/health` OK).  
Offline mutations queue with **compaction** (e.g. create + delete dropped; create + update merged). On reconnect, `POST /api/products/sync` replays the queue.

### Backend layers

- **Routes** → **controllers** → **Sequelize models** / repositories  
- **authMiddleware:** `requireAuth`, `requireAdmin`, `requirePermission(perm)`  
- **Public reads:** `GET /api/products` and `GET /api/products/:id` (guest catalog)  
- **Events:** product changes broadcast on WebSocket (`product:created`, `updated`, `deleted`, `batch`)

---

## Project structure

```
estethis-bronze-silver-gold/
├── backend/
│   ├── app.js, server.js          # Express, HTTP(S), WS, GraphQL mount
│   ├── routes.js, controller.js   # Products REST + generator
│   ├── syncController.js          # Offline queue replay
│   ├── authRoutes.js, authController.js, session.js, authSeed.js
│   ├── reviewsRoutes.js, reviewsRepo.js
│   ├── adminRoutes.js, actionLogger.js, threatDetector.js
│   ├── generator.js, realtime.js, events.js
│   ├── graphql/                   # Schema + resolvers (Gold)
│   ├── chat/                      # Chat routes + optional Mongo model
│   ├── models/, migrations/       # Sequelize (products, reviews, users, roles, …)
│   └── *.test.js                  # Vitest / Supertest suites
├── src/
│   ├── App.jsx                    # Auth, routing, cart, orders, coupons, WS merge
│   ├── data/
│   │   ├── api.js, storage.js, offlineQueue.js, realtime.js, crud.js, validators.js
│   ├── hooks/
│   │   ├── useConnection.js, useInfiniteProducts.js
│   ├── components/
│   │   ├── MasterView, DetailView, StatisticsView, ProductForm
│   │   ├── CartDrawer, CheckoutPage, OrderHistoryPage, TicketMachinePage
│   │   ├── GuestAuthModal, AtelierMode, StaticPage, Footer
│   │   ├── LoginPage, RegisterPage, OfflineBanner, GeneratorPanel, LiveCharts
│   │   ├── ReviewsPanel, ChatPanel, UsersView, ActionLogsView, …
│   └── styles/                    # components, cart, account, ticketmachine, gold, …
├── .env.example
├── docker-compose.yml             # Optional services (e.g. MongoDB)
├── vite.config.js
└── package.json
```

---

## API overview


| Endpoint                                                     | Auth                      | Description                                              |
| ------------------------------------------------------------ | ------------------------- | -------------------------------------------------------- |
| `GET /api/products`                                          | Public                    | Paginated list, search, sort                             |
| `GET /api/products/:id`                                      | Public                    | Single product                                           |
| `POST/PUT/DELETE /api/products`                              | `products:write`          | CRUD                                                     |
| `POST /api/products/sync`                                    | `products:write`          | Offline queue replay                                     |
| `GET /api/products/generator`, `…/start`, `…/stop`, `…/tick` | Auth + `generator:manage` | Faker loop                                               |
| `GET /api/health`                                            | Public                    | Liveness for connection detector                         |
| `/api/auth/*`                                                | Varies                    | Register, login, OTP, magic link, session, users (admin) |
| `/api/reviews/*`                                             | Auth                      | Product reviews (Gold)                                   |
| `/api/admin/*`                                               | Admin                     | Logs, observation list                                   |
| `/graphql`                                                   | Varies                    | GraphQL alternative to REST (Gold)                       |
| `ws://…/ws`                                                  | —                         | Realtime product + generator + chat events               |


Session header: `X-Session-Token: <token>` (set on login/register).

---

## Testing

```bash
npm test                    # Full suite
npm run test:coverage       # Coverage report
npm run test:frontend       # src/
npm run test:backend        # Core API + silver + gold + db
npm run test:auth           # Auth + session
npm run test:auth:frontend
npm run test:chat
npm run test:action-log
npm run test:threats
```

Frontend includes validation tests; backend uses Supertest against the Express app and isolated DB setup where needed.

---

## Environment

Copy `.env.example` to `.env`. Important variables:

- **Database:** `DB_DIALECT=sqlite`, `DB_STORAGE=./estethis.sqlite3` or `DATABASE_URL` for PostgreSQL  
- **Ports:** `PORT`, `HTTPS_PORT`, `HOST`  
- **Session:** `SESSION_TIMEOUT_MS` (default 30 min; matches client inactivity logout)  
- **CORS:** `CORS_ORIGIN`  
- **Chat:** `MONGO_URI` (optional)

For Vite on another machine, use `.env.local` with `BACKEND_HOST` / `BACKEND_PORT` (see comments in `.env.example`).

**TLS:** Run `node generate-cert.js [LAN-IP]` for local HTTPS.

---

## Development tiers (Bronze → Silver → Gold)

### Bronze

- REST CRUD, layered backend, shared validation rules  
- Pagination, auth foundation, product forms and statistics UI

### Silver

- WebSocket broadcasting and live UI merge  
- Offline queue + sync endpoint + optimistic mutations  
- Faker generator, health probe, connection banner, live charts

### Gold

- Infinite scroll hook and server-side filtered pages  
- Reviews relationship and UI  
- GraphQL alongside REST

### E-commerce extensions (Phases 1–8)

1. RBAC-aware UI (hide edit/delete / admin actions for non-writers)
2. Cart, checkout, orders
3. Order history, static pages, footer
4. Ticket Machine gamification
5. `storage.js` — user-scoped cart, cookies, session restore fixes
6. Guest mode + `GuestAuthModal`
7. Admin Orders / Inbox / sales KPIs
8. Atelier validation; My Coupons tab; checkout promo codes

---

## Scripts reference


| Script                         | Purpose                     |
| ------------------------------ | --------------------------- |
| `npm run dev:all`              | Backend + Vite concurrently |
| `npm run start:backend`        | API + WS + GraphQL          |
| `npm run dev`                  | Vite dev server             |
| `npm run build`                | Production frontend bundle  |
| `npm run migrate`              | Run Sequelize migrations    |
| `npm run cert` / `cert:mkcert` | Local TLS certificates      |


---

## License and status

Private academic / portfolio project (`package.json`: `"private": true`). Not intended for production payments — checkout is **simulated** only.

For stack rationale (Express vs alternatives), see `backend/RATIONALE.md` if present in your checkout.