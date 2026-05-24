#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// SETUP-MKCERT — generate a locally-trusted TLS certificate
//
// Uses mkcert to create a certificate signed by a local CA that
// your OS (and browsers) trust automatically → green padlock,
// no "not secure" strikethrough.
//
// Usage:
//   node setup-mkcert.js              # auto-detect LAN IP
//   node setup-mkcert.js 192.168.1.X  # explicit LAN IP
//
// Prerequisites:
//   winget install FiloSottile.mkcert
//         -or-
//   choco install mkcert
// ─────────────────────────────────────────────────────────────

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { networkInterfaces }    from 'node:os';
import path  from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 1. Verify mkcert is installed ────────────────────────────

function hasMkcert() {
  try { execSync('mkcert -version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

if (!hasMkcert()) {
  console.error('\n  ✗  mkcert not found in PATH.\n');
  console.error('  Install it first:\n');
  if (process.platform === 'win32') {
    console.error('    winget install FiloSottile.mkcert');
    console.error('      — or —');
    console.error('    choco install mkcert');
    console.error('      — or —');
    console.error('    Download from https://github.com/FiloSottile/mkcert/releases');
    console.error('    and place mkcert.exe somewhere on your PATH.\n');
  } else if (process.platform === 'darwin') {
    console.error('    brew install mkcert\n');
  } else {
    console.error('    sudo apt install mkcert  (or use Linuxbrew)\n');
  }
  console.error('  After installing, close and reopen the terminal, then run:');
  console.error('    node setup-mkcert.js\n');
  process.exit(1);
}

// ── 2. Collect all non-loopback IPv4 addresses ───────────────

function detectAllLanIps() {
  const ips = new Set();
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) ips.add(addr.address);
    }
  }
  return [...ips];
}

// Extra IPs can be passed as CLI args: node setup-mkcert.js 192.168.1.X
const extraIps = process.argv.slice(2);
const lanIps   = extraIps.length ? extraIps : detectAllLanIps();

const HOSTS = ['localhost', '127.0.0.1', '::1', ...lanIps];

// ── 3. Prepare certs directory ────────────────────────────────

const CERT_DIR  = path.join(__dirname, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'server.cert');
const KEY_FILE  = path.join(CERT_DIR, 'server.key');

if (!existsSync(CERT_DIR)) mkdirSync(CERT_DIR, { recursive: true });

// ── 4. Install the local CA into the system trust store ───────

console.log('\n  Installing mkcert local CA into system trust store…');
try {
  execSync('mkcert -install', { stdio: 'inherit' });
} catch (err) {
  console.error('  ✗  mkcert -install failed:', err.message);
  process.exit(1);
}

// ── 5. Generate the certificate ───────────────────────────────

console.log(`\n  Generating certificate for: ${HOSTS.join('  ')}`);

const result = spawnSync('mkcert', [
  '-key-file', KEY_FILE,
  '-cert-file', CERT_FILE,
  ...HOSTS,
], { stdio: 'inherit' });

if (result.status !== 0) {
  console.error('\n  ✗  Certificate generation failed.');
  process.exit(1);
}

// ── 6. Find the CA root cert (for phone installation) ─────────

let caRoot = '';
try {
  caRoot = execSync('mkcert -CAROOT', { encoding: 'utf8' }).trim();
} catch { /* ignore */ }

const caCertPath = caRoot
  ? path.join(caRoot, 'rootCA.pem')
  : '(run: mkcert -CAROOT to find it)';

// ── 7. Print summary ──────────────────────────────────────────

console.log('\n');
console.log('  ┌──────────────────────────────────────────────────────────┐');
console.log('  │  ✓  mkcert certificate ready                             │');
console.log('  │                                                          │');
console.log(`  │  cert  →  certs/server.cert                              │`);
console.log(`  │  key   →  certs/server.key                               │`);
console.log('  │                                                          │');
console.log('  │  Your browser on THIS machine will show a green lock.    │');
console.log('  │                                                          │');
console.log('  │  ── To fix the phone / other devices ────────────────── │');
console.log('  │                                                          │');
console.log('  │  1. Copy the CA certificate to your phone:              │');
console.log(`  │     ${caCertPath.padEnd(53)}│`);
console.log('  │                                                          │');
console.log('  │  2. Android: open rootCA.pem on the phone → install as  │');
console.log('  │     "CA certificate" under Security > Encryption &      │');
console.log('  │     Credentials > Install a certificate.                │');
console.log('  │                                                          │');
console.log('  │  3. iOS: AirDrop/share rootCA.pem → tap to install →    │');
console.log('  │     Settings > General > VPN & Device Management →      │');
console.log('  │     trust the "mkcert" profile →                        │');
console.log('  │     Settings > General > About > Certificate Trust      │');
console.log('  │     Settings → enable the mkcert CA.                    │');
console.log('  │                                                          │');
console.log('  │  ── Restart the server ─────────────────────────────── │');
console.log('  │                                                          │');
console.log('  │  npm run start:backend   (or  npm run dev:all)          │');
console.log('  └──────────────────────────────────────────────────────────┘');

if (lanIps.length) {
  for (const ip of lanIps) console.log(`  App reachable at: https://${ip}:3443`);
} else {
  console.log('\n  Could not detect a LAN IP.');
  console.log('  Re-run with:  node setup-mkcert.js <your-LAN-IP>');
}
console.log('');
