// ─────────────────────────────────────────────────────────────
// SERVER — entry point
//   1. Initialises Sequelize models + syncs schema
//   2. Seeds the database with initial data
//   3. Wraps Express in https.Server (self-signed cert), attaches WebSocket
//   4. Binds to HOST (0.0.0.0) so LAN machines can reach the API
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';
import https from 'node:https';
import http  from 'node:http';
import fs    from 'node:fs';
import path  from 'node:path';
import { fileURLToPath } from 'node:url';

// Import models first so associations are registered before sync
import { sequelize }        from './models/index.js';
import app                  from './app.js';
import repository           from './repository.js';
import reviewsRepo          from './reviewsRepo.js';
import SEED                 from './seed.js';
import REVIEWS_SEED         from './reviewsSeed.js';
import { attach as attachRealtime } from './realtime.js';
import * as generator       from './generator.js';
import authSeed             from './authSeed.js';
import mongoose             from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT       = parseInt(process.env.PORT  || '3001');
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443');
const HOST       = process.env.HOST || '0.0.0.0';

// ── TLS certificate paths ─────────────────────────────────────
const CERT_DIR  = path.join(__dirname, '..', 'certs');
const CERT_FILE = path.join(CERT_DIR, 'server.cert');
const KEY_FILE  = path.join(CERT_DIR, 'server.key');

function loadTlsOptions() {
  try {
    return {
      cert: fs.readFileSync(CERT_FILE),
      key:  fs.readFileSync(KEY_FILE),
    };
  } catch {
    return null;
  }
}

async function main() {
  // ── 1. Sync schema ────────────────────────────────────────────
  await sequelize.sync({ alter: false });
  console.log('  ✓ Database schema synced');

  // ── 1b. Seed roles / permissions / default accounts ───────────
  await authSeed();
  console.log('  ✓ Auth seed complete (admin@estethis.com / user@estethis.com)');

  // ── 2. Create server (HTTPS preferred, HTTP fallback) ─────────
  const tlsOpts = loadTlsOptions();

  let primaryServer;
  let proto;

  if (tlsOpts) {
    primaryServer = https.createServer(tlsOpts, app);
    proto = 'https';
    // Also start an HTTP → HTTPS redirect on PORT
    const redirectApp = http.createServer((_req, res) => {
      const host = _req.headers.host?.replace(/:\d+$/, '') || HOST;
      res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${_req.url}` });
      res.end();
    });
    redirectApp.listen(PORT, HOST, () =>
      console.log(`  ↪ HTTP redirect http://${HOST}:${PORT} → https://${HOST}:${HTTPS_PORT}`));
  } else {
    console.warn('  ⚠  No TLS certificate found — falling back to HTTP');
    primaryServer = http.createServer(app);
    proto = 'http';
  }

  const listenPort = tlsOpts ? HTTPS_PORT : PORT;
  const realtime   = attachRealtime({ httpServer: primaryServer });

  await new Promise((resolve, reject) => {
    primaryServer.once('error', reject);
    primaryServer.listen(listenPort, HOST, () => {
      console.log('');
      console.log('  ┌──────────────────────────────────────────────────────┐');
      console.log('  │ Estethis backend up                                  │');
      console.log(`  │   REST       ${proto}://${HOST}:${listenPort}/api         │`);
      console.log(`  │   WebSocket  wss://${HOST}:${listenPort}/ws              │`);
      console.log(`  │   Health     ${proto}://${HOST}:${listenPort}/api/health  │`);
      if (tlsOpts) {
        console.log(`  │   TLS cert   certs/server.cert (self-signed)         │`);
        console.log(`  │   NOTE: accept the browser security warning once     │`);
      }
      console.log('  └──────────────────────────────────────────────────────┘');
      resolve();
    });
  });

  // ── 3. MongoDB (optional) ─────────────────────────────────────
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/estethis_chat';
  mongoose.connection.on('reconnected', () =>
    console.log('  ✓ MongoDB reconnected — chat history restored'));
  mongoose.connection.on('disconnected', () =>
    console.warn('  ⚠  MongoDB disconnected — chat falls back to in-memory'));
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    console.log('  ✓ MongoDB connected — chat history enabled');
  } catch (err) {
    console.warn('  ⚠  MongoDB unavailable — chat works in-memory:', err.message);
  }

  // ── 4. Seed product data ──────────────────────────────────────
  try {
    const existing = await repository.count();
    if (existing === 0) {
      await repository.seed(SEED);
      await reviewsRepo.seed(REVIEWS_SEED);
      console.log(`  ✓ Seeded ${SEED.length} products, ${REVIEWS_SEED.length} reviews`);
    }
  } catch (err) {
    console.warn('  ⚠  Product seed failed (non-fatal):', err.message);
  }

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
      console.log(`\n[${sig}] shutting down…`);
      generator.stop();
      await realtime.close();
      primaryServer.close(async () => {
        await sequelize.close();
        await mongoose.disconnect().catch(() => {});
        process.exit(0);
      });
    });
  }
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
