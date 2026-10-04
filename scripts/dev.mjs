import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";

// 1. Start Next.js dev server
const nextCmd = isWin ? "npx.cmd" : "npx";
const nextProcess = spawn(nextCmd, ["next", "dev"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: true,
});

// 2. Poll until Next.js dev server is reachable on port 3000
async function waitForDevServer(port = 3000, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.status < 500) return true;
    } catch {
      // Dev server still booting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// 3. Once ready, launch Domshift
let domshiftProcess = null;

(async () => {
  const ready = await waitForDevServer(3000);
  if (!ready) {
    console.error("\x1b[31m[Domshift] Timed out waiting for Next.js dev server.\x1b[0m");
    return;
  }

  // Resolve domshift binary: prefer local workspace sibling if present, else fallback to npx
  const localCliBin = path.resolve(projectRoot, "../domshift/packages/cli/bin/domshift.js");
  const nodeModulesBin = path.resolve(projectRoot, "node_modules/@agrimsinghx/domshift/bin/domshift.js");

  let cliPath = null;
  if (fs.existsSync(localCliBin)) {
    cliPath = localCliBin;
  } else if (fs.existsSync(nodeModulesBin)) {
    cliPath = nodeModulesBin;
  }

  if (cliPath) {
    domshiftProcess = spawn(process.execPath, [cliPath, "3000"], {
      cwd: projectRoot,
      stdio: "inherit",
    });
  } else {
    const npxCmd = isWin ? "npx.cmd" : "npx";
    domshiftProcess = spawn(npxCmd, ["@agrimsinghx/domshift", "3000"], {
      cwd: projectRoot,
      stdio: "inherit",
      shell: true,
    });
  }

  domshiftProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[Domshift] Process exited with code ${code}`);
    }
  });
})();

// 4. Handle clean termination
function cleanup() {
  if (domshiftProcess) {
    try { domshiftProcess.kill("SIGTERM"); } catch {}
  }
  if (nextProcess) {
    try { nextProcess.kill("SIGTERM"); } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

nextProcess.on("exit", (code) => {
  if (domshiftProcess) {
    try { domshiftProcess.kill("SIGTERM"); } catch {}
  }
  process.exit(code ?? 0);
});
