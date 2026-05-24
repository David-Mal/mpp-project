// ─────────────────────────────────────────────────────────────
// kill-port.cjs — pre-start helper
//
// Kills any process already listening on PORT (default 3001)
// so that `npm run start:backend` never fails with EADDRINUSE.
// Cross-platform: Windows (taskkill) and Unix (kill -9).
//
// Run via:  "prestart:backend": "node backend/kill-port.cjs"
// ─────────────────────────────────────────────────────────────

const { execSync } = require('child_process');

const PORT = parseInt(process.env.PORT || '3001', 10);

function killPort(port) {
  if (process.platform === 'win32') {
    let out = '';
    try {
      out = execSync(
        `netstat -ano | findstr ":${port}" | findstr "LISTENING"`,
        { shell: 'cmd.exe', encoding: 'utf8' }
      );
    } catch (_) {
      return; // nothing listening — nothing to kill
    }

    for (const line of out.trim().split('\n')) {
      const match = line.match(/LISTENING\s+(\d+)/);
      if (match && match[1] !== '0') {
        const pid = match[1].trim();
        try {
          execSync(`taskkill /F /PID ${pid}`, { shell: 'cmd.exe', stdio: 'ignore' });
          console.log(`  ↩  Killed stale process PID ${pid} on :${port}`);
        } catch (_) {
          // process may have already exited
        }
      }
    }
  } else {
    // macOS / Linux — lsof lists PIDs listening on the port
    try {
      const pids = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
      if (!pids) return;
      for (const pid of pids.split('\n').filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`);
          console.log(`  ↩  Killed stale process PID ${pid} on :${port}`);
        } catch (_) {}
      }
    } catch (_) {
      // nothing listening
    }
  }
}

killPort(PORT);
