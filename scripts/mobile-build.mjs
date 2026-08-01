import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'src', 'app', 'api');
const apiHiddenDir = path.join(rootDir, 'src', 'app', '_api_mobile_hidden');

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hideApiRoutes() {
  const nextCacheDir = path.join(rootDir, '.next');
  if (fs.existsSync(nextCacheDir)) {
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(apiDir)) {
    return;
  }

  if (fs.existsSync(apiHiddenDir)) {
    fs.rmSync(apiHiddenDir, { recursive: true, force: true });
  }

  fs.renameSync(apiDir, apiHiddenDir);
  console.log('Temporarily hid API routes for static mobile export.');
}

function restoreApiRoutes() {
  if (!fs.existsSync(apiHiddenDir)) {
    return;
  }

  if (fs.existsSync(apiDir)) {
    fs.rmSync(apiDir, { recursive: true, force: true });
  }

  fs.renameSync(apiHiddenDir, apiDir);
  console.log('Restored API routes.');
}

const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'https://sidequesthq.com';

try {
  hideApiRoutes();
  run('npm', ['run', 'build'], {
    MOBILE_BUILD: 'true',
    NEXT_PUBLIC_MOBILE_BUILD: 'true',
    NEXT_PUBLIC_API_ORIGIN: apiOrigin,
  });
  run('npx', ['@capacitor/cli', 'sync', 'android']);
} finally {
  restoreApiRoutes();
}
