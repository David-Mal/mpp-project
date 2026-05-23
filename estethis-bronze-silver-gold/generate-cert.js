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

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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

const openssl = process.platform === 'win32'
  ? 'C:\\msys64\\ucrt64\\bin\\openssl.exe'
  : 'openssl';

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
