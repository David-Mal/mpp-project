import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs    from 'node:fs';
import path  from 'node:path';

const CERT_DIR  = path.resolve('./certs');
const CERT_FILE = path.join(CERT_DIR, 'server.cert');
const KEY_FILE  = path.join(CERT_DIR, 'server.key');

function tlsOptions() {
  try {
    return { cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) };
  } catch {
    return undefined;
  }
}

const tls = tlsOptions();
// Backend port: 3443 when TLS certs exist, 3001 otherwise (matches server.js)
const BACKEND_PORT  = tls ? 3443 : 3001;
const BACKEND_PROTO = tls ? 'https' : 'http';
const WS_PROTO      = tls ? 'wss'   : 'ws';

// ── LAN cross-machine setup ───────────────────────────────────
// When the backend runs on a different machine (e.g. 192.168.1.10),
// set BACKEND_HOST=192.168.1.10 in a .env.local file on the client
// machine.  The Vite dev server will proxy all /api, /ws and /graphql
// requests to that host instead of 127.0.0.1.
//
// Example .env.local:
//   BACKEND_HOST=192.168.1.10
//   BACKEND_PORT=3443          # only needed to override the port
//
// Note: Vite reads .env files automatically; BACKEND_* are not
// prefixed with VITE_ because they are used only in this config
// file, not exposed to the browser bundle.
const BACKEND_HOST      = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT_OVERRIDE = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : BACKEND_PORT;

export default defineConfig({
  plugins: [react()],

  // ── Dev server ────────────────────────────────────────────────
  server: {
    port: 5173,
    host: '0.0.0.0',   // expose to LAN
    ...(tls ? { https: tls } : {}),  // HTTPS when certs available

    proxy: {
      '/api': {
        target:       `${BACKEND_PROTO}://${BACKEND_HOST}:${BACKEND_PORT_OVERRIDE}`,
        changeOrigin: true,
        secure:       false,   // accept self-signed cert for the proxy connection
      },
      '/ws': {
        target:       `${WS_PROTO}://${BACKEND_HOST}:${BACKEND_PORT_OVERRIDE}`,
        ws:           true,
        changeOrigin: true,
        secure:       false,
      },
      '/graphql': {
        target:       `${BACKEND_PROTO}://${BACKEND_HOST}:${BACKEND_PORT_OVERRIDE}`,
        changeOrigin: true,
        secure:       false,
      },
    },
  },

  // ── Vitest configuration ──────────────────────────────────────
  test: {
    environment: 'node',
    setupFiles: ['./backend/testSetup.js'],
    env: { NODE_ENV: 'test' },
    include: [
      'src/**/*.test.js',
      'src/**/*.spec.js',
      'src/**/*.test.jsx',
      'src/**/*.spec.jsx',
      'backend/**/*.test.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/data/validators.js',
        'src/data/crud.js',
        'backend/repository.js',
        'backend/reviewsRepo.js',
        'backend/validator.js',
        'backend/controller.js',
        'backend/models/**/*.js',
      ],
      thresholds: {
        lines:      85,
        functions:  90,
        branches:   80,
        statements: 85,
      },
    },
    reporter: ['verbose'],
  },
});
