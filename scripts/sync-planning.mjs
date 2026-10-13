#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const PLANNING_PATHS = [
  'plans',
  'MEMORY',
  'artifacts',
  '_archived',
  'assets/playstore-listing',
  'assets/ChatGPT Image Aug 11, 2026, 12_24_28 PM.png',
];

function cleanGitEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_PREFIX;
  return env;
}

function run(cmd, cwd = rootDir, extraEnv = {}) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: cleanGitEnv(extraEnv) }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    throw new Error(`Command failed: ${cmd}\n${stdout}\n${stderr}\n${err.message}`);
  }
}

function runSafe(cmd, cwd = rootDir, extraEnv = {}) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: cleanGitEnv(extraEnv) }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldPush = args.includes('--push');

  if (process.env.SYNC_PUSHING === '1') {
    return;
  }

  console.log('🔄 Starting branch synchronization between master and planning...');

  // 1. Locate planning worktree or directory
  let planningDir = resolve(rootDir, '..', 'undone-site-planning');
  let isWorktree = false;

  const worktrees = runSafe('git worktree list', rootDir);
  if (worktrees) {
    const lines = worktrees.split('\n');
    for (const line of lines) {
      if (line.includes('[planning]')) {
        planningDir = line.split(/\s+/)[0];
        isWorktree = true;
        break;
      }
    }
  }

  if (!existsSync(planningDir)) {
    console.log(`Creating planning worktree at ${planningDir}...`);
    run(`git worktree add "${planningDir}" planning`, rootDir);
    isWorktree = true;
  }

  // 2. Ensure master does not track any planning files
  console.log('🧹 Verifying master branch cleanliness...');
  let untrackedCount = 0;
  for (const p of PLANNING_PATHS) {
    const tracked = runSafe(`git ls-files "${p}"`, rootDir);
    if (tracked && tracked.length > 0) {
      console.log(`  Untracking ${p} from master...`);
      runSafe(`git rm -r --cached "${p}"`, rootDir);
      untrackedCount++;
    }
  }

  if (untrackedCount > 0) {
    const status = runSafe('git status --porcelain', rootDir);
    if (status) {
      run('git commit -m "chore: ensure planning assets remain off master branch"', rootDir);
      console.log('  Committed cleanup on master.');
    }
  }

  // 3. Sync planning assets from master to planning worktree
  console.log('📦 Syncing planning assets to planning worktree...');
  for (const relPath of PLANNING_PATHS) {
    const srcPath = resolve(rootDir, relPath);
    const destPath = resolve(planningDir, relPath);
    if (existsSync(srcPath)) {
      cpSync(srcPath, destPath, { recursive: true, force: true });
    }
  }

  // 4. Merge master into planning worktree
  console.log('🔀 Merging master into planning...');
  const currentMasterSha = run('git rev-parse HEAD', rootDir);
  
  // Check if planning already contains current master
  const isAncestor = runSafe(`git merge-base --is-ancestor ${currentMasterSha} HEAD`, planningDir);
  if (isAncestor === null) {
    // Need to merge
    try {
      run(`git merge --no-commit --no-ff ${currentMasterSha}`, planningDir);
    } catch {
      // Resolve any expected planning conflicts favoring planning
      for (const relPath of PLANNING_PATHS) {
        runSafe(`git checkout HEAD -- "${relPath}"`, planningDir);
      }
    }
  }

  // 5. Stage and commit planning assets on planning worktree
  for (const relPath of PLANNING_PATHS) {
    if (existsSync(resolve(planningDir, relPath))) {
      runSafe(`git add -f "${relPath}"`, planningDir);
    }
  }
  runSafe('git add .gitmodules', planningDir);
  runSafe('git add packages/interaction-builder', planningDir);

  const planningStatus = runSafe('git status --porcelain', planningDir);
  if (planningStatus && planningStatus.length > 0) {
    console.log('💾 Committing updates on planning...');
    run('git commit -m "chore(planning): synchronize master updates and planning assets"', planningDir);
  } else {
    console.log('✨ Planning branch is already up to date.');
  }

  // 6. Push if requested or hook triggered
  if (shouldPush) {
    console.log('🚀 Pushing master and planning to origin...');
    const env = cleanGitEnv({ SYNC_PUSHING: '1' });
    
    // Push master
    execSync('git push origin master', { cwd: rootDir, stdio: 'inherit', env });
    
    // Push planning
    execSync('git push origin planning', { cwd: planningDir, stdio: 'inherit', env });
    
    console.log('✅ Both branches successfully pushed to origin.');
  }

  console.log('🎉 Branch synchronization completed successfully.');
}

main().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
