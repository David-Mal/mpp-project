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

export default defineConfig({
  plugins: [react()],

  // ── Dev server ────────────────────────────────────────────────
  server: {
    port: 5173,
    host: '0.0.0.0',   // expose to LAN
    ...(tls ? { https: tls } : {}),  // HTTPS when certs available

    proxy: {
      '/api': {
        target:       `${BACKEND_PROTO}://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
        secure:       false,   // accept self-signed cert for the proxy connection
      },
      '/ws': {
        target:       `${WS_PROTO}://127.0.0.1:${BACKEND_PORT}`,
        ws:           true,
        changeOrigin: true,
        secure:       false,
      },
      '/graphql': {
        target:       `${BACKEND_PROTO}://127.0.0.1:${BACKEND_PORT}`,
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
