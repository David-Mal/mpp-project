// ─────────────────────────────────────────────────────────────
// APP — Express application factory
// ─────────────────────────────────────────────────────────────

import express    from 'express';
import cors       from 'cors';
import path       from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import 'dotenv/config';
import router     from './routes.js';
import reviewsRouter from './reviewsRoutes.js';
import authRouter   from './authRoutes.js';
import chatRouter   from './chat/chatRoutes.js';
import adminRouter  from './adminRoutes.js';
import { loadUser } from './authMiddleware.js';
import { actionLoggerMiddleware } from './actionLogger.js';
import { authLimiter } from './rateLimit.js';
import repository from './repository.js';
import * as gen   from './generator.js';
import { yogaHandler } from './graphql/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// ── CORS — allow remote machines / VMs ───────────────────────
// CORS_ORIGIN=* allows all origins (default).
// Restrict in production: CORS_ORIGIN=https://my-frontend.com
app.use(cors({
  origin:         process.env.CORS_ORIGIN || '*',
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
}));

app.use(express.json({ limit: '1mb' }));

// ── Global auth + action logging (Step 1 & 3) ────────────────
// loadUser sets req.user from the X-Session-Token header on every
// request. actionLoggerMiddleware then persists the action if a
// user is authenticated. Both run before any route handler.
app.use(loadUser);
app.use(actionLoggerMiddleware);

// ── Health probe (async — repository is DB-backed) ───────────
app.get('/api/health', async (_req, res) => {
  try {
    const products = await repository.count();
    res.json({ status: 'ok', products, generator: gen.status(), uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'degraded', uptime: process.uptime() });
  }
});

// ── Auth (Step 1) — rate-limited login/register ───────────────
// authLimiter: max 10 attempts per IP per 15-minute window.
// Applied only to /login and /register (write paths), not to
// /me, /logout, or /users which are already auth-gated.
app.post('/api/auth/login',    authLimiter);
app.post('/api/auth/register', authLimiter);
app.use('/api/auth', authRouter);

// ── Admin (Step 3 & 4) ────────────────────────────────────────
app.use('/api/admin', adminRouter);

// ── Chat REST (Step 2) ────────────────────────────────────────
app.use('/api/chat', chatRouter);

// ── REST API (Bronze + Silver) ────────────────────────────────
app.use('/api/products', router);

// ── Reviews REST (Gold 1-to-many) ────────────────────────────
app.use('/api', reviewsRouter);

// ── GraphQL (Gold) ───────────────────────────────────────────
app.use(yogaHandler.graphqlEndpoint, yogaHandler);

// ── Serve built frontend (LAN / production mode) ─────────────
// When `npm run build` has been run, serve the dist/ folder so
// the phone can access the full app from a single HTTPS port
// without needing to trust a second certificate.
const DIST = path.join(__dirname, '..', 'dist');
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  // SPA fallback — all non-API paths return index.html
  app.get(/^(?!\/api|\/ws|\/graphql).*/, (_req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

export default app;
