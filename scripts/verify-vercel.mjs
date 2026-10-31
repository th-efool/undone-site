#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

function step(name, cmd) {
  console.log(`\n▶ [Vercel Pre-Verify] ${name}...`);
  const start = Date.now();
  try {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } });
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✔ [Vercel Pre-Verify] ${name} PASSED in ${duration}s`);
  } catch (err) {
    console.error(`\n✖ [Vercel Pre-Verify] ${name} FAILED!`);
    process.exit(1);
  }
}

console.log('🔍 ========================================================');
console.log('   Running Vercel Deployment Pre-Verification Pipeline     ');
console.log('===========================================================');

// 1. Verify and initialize submodules
step('Checking Git Submodules', 'node scripts/ensure-submodules.mjs');

// 2. Prebuild internal packages (guarantees up-to-date declaration files)
step('Building Internal Packages', 'npm run prebuild');

// 3. Prisma Client Generation (guarantees up-to-date database client types)
step('Prisma Client Generation', 'npx prisma generate');

// 4. TypeScript Verification (authoritative blocker across entire codebase)
step('TypeScript Verification', 'npx tsc --noEmit --incremental false');

// 5. Full Production Build (matching Vercel serverless environment)
step('Production Build Simulation', 'node --max-old-space-size=4096 --import ./scripts/register-root-environment.mjs ./node_modules/next/dist/bin/next build');

console.log('\n===========================================================');
console.log('🎉 VERIFICATION SUCCESS: Project is ready for Vercel deploy!');
console.log('===========================================================\n');
