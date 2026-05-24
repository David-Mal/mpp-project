#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// GENERATE SELF-SIGNED TLS CERTIFICATE
// Usage:  node generate-cert.js [LAN_IP]
// Output: certs/server.key  +  certs/server.cert
//
// The certificate includes SANs for:
//   - localhost
//   - 127.0.0.1
//   - The detected (or supplied) LAN IP
//
// Browsers will show a security warning the first time — click
// "Advanced → Proceed" to accept the self-signed cert once.
// ─────────────────────────────────────────────────────────────

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERTS_DIR = path.join(__dirname, 'certs');

function detectLanIp() {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.')) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const lanIp = process.argv[2] || detectLanIp();
console.log(`Generating self-signed TLS certificate for localhost + ${lanIp}…`);

mkdirSync(CERTS_DIR, { recursive: true });

const cnfPath  = path.join(CERTS_DIR, 'openssl.cnf');
const keyPath  = path.join(CERTS_DIR, 'server.key');
const certPath = path.join(CERTS_DIR, 'server.cert');

const cnf = `[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_req

[dn]
C  = RO
ST = Cluj
L  = Cluj-Napoca
O  = Estethis Lab
CN = estethis-lab

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1  = 127.0.0.1
IP.2  = ${lanIp}
`;

writeFileSync(cnfPath, cnf);

function findOpenssl() {
  if (process.platform !== 'win32') return 'openssl';

  // 1. Try whatever is on PATH first (works for OpenSSL installed via winget / chocolatey)
  try { execSync('openssl version', { stdio: 'ignore' }); return 'openssl'; } catch { /* not in PATH */ }

  // 2. Fall back to well-known Windows installation directories
  const candidates = [
    'C:\\msys64\\ucrt64\\bin\\openssl.exe',
    'C:\\msys64\\mingw64\\bin\\openssl.exe',
    'C:\\msys64\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
    'C:\\Program Files\\OpenSSL\\bin\\openssl.exe',
    'C:\\OpenSSL-Win64\\bin\\openssl.exe',
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      console.log(`Found OpenSSL at: ${p}`);
      return p;
    }
  }
  throw new Error(
    'OpenSSL executable not found.\n' +
    'Install it via one of:\n' +
    '  • winget install ShiningLight.OpenSSL.Light\n' +
    '  • choco install openssl\n' +
    '  • Include the OpenSSL bin directory in your PATH\n' +
    '  • Install MSYS2 (https://www.msys2.org/) and run: pacman -S mingw-w64-ucrt-x86_64-openssl',
  );
}

const openssl = findOpenssl();

execFileSync(openssl, [
  'req', '-x509',
  '-newkey', 'rsa:2048',
  '-keyout', keyPath,
  '-out', certPath,
  '-days', '730',
  '-nodes',
  '-config', cnfPath,
], { stdio: 'inherit' });

console.log(`\nCertificate written to:`);
console.log(`  Key:  ${keyPath}`);
console.log(`  Cert: ${certPath}`);
console.log(`\nLAN IP included in certificate: ${lanIp}`);
console.log(`Run "node generate-cert.js <YOUR_LAN_IP>" to regenerate with a different IP.`);
