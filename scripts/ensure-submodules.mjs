#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const interactionPkg = resolve(rootDir, 'packages', 'interaction-builder', 'package.json');

if (!existsSync(interactionPkg)) {
  console.log('📦 Submodule packages/interaction-builder not found on disk. Initializing...');
  let initialized = false;

  try {
    console.log('  Attempting git submodule update --init...');
    execSync('git submodule update --init --recursive packages/interaction-builder', {
      cwd: rootDir,
      stdio: 'inherit',
    });
    if (existsSync(interactionPkg)) {
      initialized = true;
      console.log('✅ Submodule packages/interaction-builder initialized via git submodule.');
    }
  } catch (err) {
    console.warn('⚠️ git submodule update failed, falling back to git clone:', err.message);
  }

  if (!initialized) {
    try {
      console.log('  Cloning packages/interaction-builder from GitHub over HTTPS...');
      execSync('git clone --depth=1 https://github.com/th-efool/interaction-builder.git packages/interaction-builder', {
        cwd: rootDir,
        stdio: 'inherit',
      });
      if (existsSync(interactionPkg)) {
        console.log('✅ Cloned packages/interaction-builder successfully.');
      } else {
        console.error('❌ Could not locate package.json after clone.');
      }
    } catch (cloneErr) {
      console.error('❌ Failed to clone interaction-builder:', cloneErr.message);
    }
  }
} else {
  console.log('✅ packages/interaction-builder is ready.');
}
