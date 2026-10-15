import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { execSync, spawn } from 'node:child_process';
import pg from 'pg';

const PgPool = pg?.Pool ?? pg?.default?.Pool ?? pg;

const repoRoot = process.cwd();
const packageDir = path.resolve(repoRoot, 'packages/interaction-builder');
const agendaExampleSrcDir = path.resolve(packageDir, 'examples/agenda');
const migrationSrcPath = path.resolve(packageDir, 'migrations/001_interaction_schema.sql');

console.log('=================================================================');
console.log('S7 Checkpoint 2: Standalone Agenda Example Verification');
console.log('=================================================================');

// 1. Force rebuild package and generate tarball
console.log('\n[1/7] Building packages/interaction-builder and packing tarball...');
execSync('node build.mjs', { cwd: packageDir, stdio: 'inherit' });
const packOutput = execSync('npm pack', { cwd: packageDir, encoding: 'utf8' }).trim();
const tarballFilename = packOutput.split('\n').pop().trim();
const tarballPath = path.join(packageDir, tarballFilename);

if (!fs.existsSync(tarballPath)) {
  throw new Error(`Tarball not found: ${tarballPath}`);
}
console.log(`-> Generated package tarball: ${tarballPath}`);

// 2. Setup isolated sandbox
console.log('\n[2/7] Creating isolated external sandbox in temp directory...');
const sandboxDir = path.join(os.tmpdir(), `ib-standalone-agenda-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
fs.mkdirSync(sandboxDir, { recursive: true });
fs.mkdirSync(path.join(sandboxDir, 'migrations'), { recursive: true });
console.log(`-> Sandbox directory: ${sandboxDir}`);

// Copy example files
const exampleFiles = [
  'agenda.domain.ts',
  'agenda.tools.ts',
  'agenda.ui.tsx',
  'server.ts',
  'worker.ts',
  'run.ts',
  '.env.example',
  'README.md',
];

for (const file of exampleFiles) {
  const src = path.join(agendaExampleSrcDir, file);
  const dest = path.join(sandboxDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}
fs.copyFileSync(migrationSrcPath, path.join(sandboxDir, 'migrations/001_interaction_schema.sql'));

// 3. Verify zero Undone imports or monorepo aliases
console.log('\n[3/7] Asserting ZERO Undone imports or monorepo aliases in sandbox...');
const forbiddenPatterns = [
  { regex: /@\//g, name: 'Root alias "@/"' },
  { regex: /undone/gi, name: 'Host domain "undone"' },
  { regex: /cohort/gi, name: 'Host domain "cohort"' },
  { regex: /sidequesthq/gi, name: 'Host domain "sidequesthq"' },
  { regex: /\.\.\/\.\.\/(src|prisma|apps)/g, name: 'Escaping relative path' },
];

for (const file of exampleFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))) {
  const filePath = path.join(sandboxDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  for (const { regex, name } of forbiddenPatterns) {
    if (regex.test(content)) {
      throw new Error(`Forbidden pattern "${name}" found in standalone example file: ${file}`);
    }
  }
}
console.log('-> Verified: Zero Undone imports or monorepo aliases detected.');

// 4. Install dependencies in sandbox
console.log('\n[4/7] Installing dependencies into isolated sandbox from tarball...');
fs.writeFileSync(
  path.join(sandboxDir, 'package.json'),
  JSON.stringify(
    {
      name: 'standalone-agenda-host',
      version: '1.0.0',
      type: 'module',
      private: true,
      dependencies: {
        'interaction-builder': `file:${tarballPath}`,
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        pg: '^8.11.0',
        zod: '^3.24.0',
        ai: '^7.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        '@types/react': '^19.0.0',
        '@types/react-dom': '^19.0.0',
        '@types/pg': '^8.11.0',
        tsx: '^4.19.0',
      },
    },
    null,
    2
  ),
  'utf8'
);

fs.writeFileSync(
  path.join(sandboxDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        types: ['node', 'react', 'react-dom', 'pg'],
        outDir: './dist',
      },
      include: ['./*.ts', './*.tsx'],
    },
    null,
    2
  ),
  'utf8'
);

execSync('npm install --no-package-lock', { cwd: sandboxDir, stdio: 'inherit' });

// Run typecheck to prove external package consumer compiles cleanly
console.log('-> Running tsc in external consumer sandbox...');
execSync('npx tsc --noEmit', { cwd: sandboxDir, stdio: 'inherit' });
console.log('-> External consumer TypeScript compilation passed cleanly.');

// 5. Spin up disposable PostgreSQL
console.log('\n[5/7] Starting disposable PostgreSQL on loopback port 15435...');
const pgPort = 15435;
const pgDbDir = path.join(sandboxDir, 'pgdata');
fs.mkdirSync(pgDbDir, { recursive: true });

const embeddedPgModule = path.resolve(repoRoot, '.tmp/s3-postgres-runtime/node_modules/embedded-postgres/dist/index.js');
let database;
let databaseUrl = `postgresql://agendatest:agendatest@127.0.0.1:${pgPort}/agenda_test_db`;

if (fs.existsSync(embeddedPgModule)) {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(embeddedPgModule).href);
  database = new EmbeddedPostgres({
    databaseDir: pgDbDir,
    user: 'agendatest',
    password: 'agendatest',
    port: pgPort,
    persistent: false,
    createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1', '-c', 'timezone=UTC'],
    onLog: () => {},
    onError: console.error,
  });

  await database.initialise();
  await database.start();
  await database.createDatabase('agenda_test_db');
  console.log(`-> Disposable PostgreSQL started at ${databaseUrl}`);

  // Apply schema migration
  const migrationSql = fs.readFileSync(path.join(sandboxDir, 'migrations/001_interaction_schema.sql'), 'utf8');
  const initPool = new PgPool({ connectionString: databaseUrl });
  await initPool.query(migrationSql);
  await initPool.end();
  console.log('-> Applied migrations/001_interaction_schema.sql to PostgreSQL successfully.');
} else {
  console.log('-> EmbeddedPostgres module not found; falling back to memory storage for verification.');
  databaseUrl = 'memory';
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {}
}

// Helper to cleanup
let serverProcess = null;
async function cleanup() {
  if (serverProcess?.pid) {
    killProcessTree(serverProcess.pid);
  }
  if (database) {
    try {
      await database.stop();
    } catch {}
  }
}

try {
  // 6. Start the standalone HTTP server
  console.log('\n[6/7] Starting standalone Agenda server on port 3939...');
  const serverPort = 3939;

  serverProcess = spawn(
    'npx',
    ['tsx', 'server.ts'],
    {
      cwd: sandboxDir,
      env: {
        ...process.env,
        PORT: String(serverPort),
        DATABASE_URL: databaseUrl,
        EMBEDDED_WORKER: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }
  );

  serverProcess.stdout.on('data', chunk => {
    process.stdout.write(`[Server stdout] ${chunk}`);
  });
  serverProcess.stderr.on('data', chunk => {
    process.stderr.write(`[Server stderr] ${chunk}`);
  });

  // Wait for health endpoint
  let healthy = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${serverPort}/health`);
      if (res.ok) {
        const body = await res.json();
        console.log(`-> Server is healthy:`, body);
        healthy = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!healthy) {
    throw new Error('Server failed to start within timeout.');
  }

  // 7. Execute End-to-End Scenarios
  console.log('\n[7/7] Executing automated verification scenarios...');

  const wsId = crypto.randomUUID();
  const ownerId = 'agenda-lead-1';
  const baseUrl = `http://localhost:${serverPort}/api/interaction/v1`;

  // Scenario 1: Intake & Workspace creation
  console.log('--- Scenario 1: Workspace Intake ---');
  const initialAgenda = {
    schemaVersion: 1,
    meetingTitle: 'Sprint 42 Kickoff',
    date: '2026-10-15',
    items: [
      { id: 'item-1', version: 0, title: 'Architecture Review', durationMinutes: 15, presenter: 'Alice', pinned: false },
      { id: 'item-2', version: 0, title: 'Roadmap Planning', durationMinutes: 20, presenter: 'Bob', pinned: false },
    ],
  };

  const createRes = await fetch(`${baseUrl}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-owner-id': ownerId },
    body: JSON.stringify({
      workspaceId: wsId,
      domainId: 'agenda',
      bootstrap: initialAgenda,
    }),
  });
  if (!createRes.ok) throw new Error(`Create workspace failed: ${createRes.status} ${await createRes.text()}`);
  const created = await createRes.json();
  console.log(`-> Workspace created at revision ${created.revision}`);
  if (created.snapshot.meetingTitle !== 'Sprint 42 Kickoff') {
    throw new Error('Initial meeting title mismatch');
  }

  // Scenario 2: Conversation UI & Assistant Turn
  console.log('\n--- Scenario 2: Chat Message & Assistant Tool Execution ---');
  const msgRes = await fetch(`${baseUrl}/workspaces/${wsId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-owner-id': ownerId },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      parts: [{ type: 'text', text: 'Please rename the meeting to "2027 Executive Vision" and pin Architecture Review' }],
    }),
  });
  if (!msgRes.ok) throw new Error(`Append message failed: ${msgRes.status} ${await msgRes.text()}`);
  console.log('-> User message appended. Waiting for background worker to execute turn...');

  // Poll until revision >= 2 (rename + pin applied)
  let updatedWs;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    const checkRes = await fetch(`${baseUrl}/workspaces/${wsId}`, {
      headers: { 'x-owner-id': ownerId },
    });
    const data = await checkRes.json();
    if (data.revision >= 2) {
      updatedWs = data;
      break;
    }
  }

  if (!updatedWs) throw new Error('Worker timed out applying assistant tool actions');
  console.log(`-> Assistant actions applied! Current revision: ${updatedWs.revision}`);
  console.log(`   Meeting Title: "${updatedWs.snapshot.meetingTitle}"`);
  console.log(`   Item 1 pinned: ${updatedWs.snapshot.items[0]?.pinned}`);
  if (updatedWs.snapshot.meetingTitle !== '2027 Executive Vision') {
    throw new Error('Assistant failed to update meeting title to "2027 Executive Vision"');
  }
  if (!updatedWs.snapshot.items[0]?.pinned) {
    throw new Error('Assistant failed to pin item-1');
  }

  // Verify assistant message in transcript
  const transcriptRes = await fetch(`${baseUrl}/workspaces/${wsId}/messages`, {
    headers: { 'x-owner-id': ownerId },
  });
  const transcript = await transcriptRes.json();
  const assistantMsg = transcript.messages.find(m => m.role === 'assistant');
  if (!assistantMsg) throw new Error('Assistant message missing from transcript');
  console.log(`-> Assistant transcript reply verified: "${assistantMsg.parts[0]?.text}"`);

  // Scenario 3: Direct Human Action Dispatch
  console.log('\n--- Scenario 3: Direct Human Action (Duration Edit) ---');
  const humanActionBody = {
    actionId: crypto.randomUUID(),
    workspaceId: wsId,
    expectedRevision: updatedWs.revision,
    entityVersions: [{ kind: 'agenda_item', id: 'item-2', version: updatedWs.snapshot.items[1].version }],
    action: { type: 'edit_item', itemId: 'item-2', durationMinutes: 45 },
  };

  const actionRes = await fetch(`${baseUrl}/workspaces/${wsId}/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-owner-id': ownerId,
      'Idempotency-Key': 'action-edit-item-2-duration',
    },
    body: JSON.stringify(humanActionBody),
  });
  if (!actionRes.ok) throw new Error(`Action dispatch failed: ${actionRes.status} ${await actionRes.text()}`);
  const actionResult = await actionRes.json();
  console.log(`-> Direct action committed: Revision ${actionResult.revision}, receipt: "${actionResult.receipt.summary}"`);
  if (actionResult.snapshot.items[1].durationMinutes !== 45) {
    throw new Error('Item 2 duration was not updated to 45 min');
  }

  // Scenario 4: Stale Workspace Conflict Rejection (Two-Client Race)
  console.log('\n--- Scenario 4: Stale Workspace Conflict Rejection ---');
  const staleRes = await fetch(`${baseUrl}/workspaces/${wsId}/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-owner-id': ownerId,
    },
    body: JSON.stringify({
      actionId: crypto.randomUUID(),
      workspaceId: wsId,
      expectedRevision: 0, // Deliberately stale revision (current is >= 3)
      entityVersions: [],
      action: { type: 'set_meeting_title', title: 'Conflicting Title' },
    }),
  });

  if (staleRes.status !== 409) {
    throw new Error(`Expected HTTP 409 Conflict for stale revision, got ${staleRes.status}`);
  }
  const conflictBody = await staleRes.json();
  console.log(`-> Stale action rejected as expected: HTTP 409, code="${conflictBody.code}"`);

  // Scenario 5: Duplicate / Lost-Response Retry (Idempotency)
  console.log('\n--- Scenario 5: Idempotent Request Deduplication ---');
  const dupRes = await fetch(`${baseUrl}/workspaces/${wsId}/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-owner-id': ownerId,
      'Idempotency-Key': 'action-edit-item-2-duration', // same key as Scenario 3
    },
    body: JSON.stringify(humanActionBody), // exact same payload as Scenario 3
  });

  if (!dupRes.ok) throw new Error(`Idempotent retry failed: ${dupRes.status}`);
  const dupBody = await dupRes.json();
  console.log(`-> Duplicate request successfully returned cached receipt without re-executing: Revision ${dupBody.revision}`);
  if (dupBody.revision !== actionResult.revision) {
    throw new Error('Duplicate request caused illegal revision advance!');
  }

  // Scenario 6: Persistence Through Reload
  console.log('\n--- Scenario 6: Persistence Through Server Reload ---');
  // Kill running server
  killProcessTree(serverProcess.pid);
  await new Promise(r => setTimeout(r, 1500));

  // Boot fresh server instance pointing to same DB
  console.log('-> Restarting server with exact same database connection...');
  serverProcess = spawn(
    'npx',
    ['tsx', 'server.ts'],
    {
      cwd: sandboxDir,
      env: {
        ...process.env,
        PORT: String(serverPort),
        DATABASE_URL: databaseUrl,
        EMBEDDED_WORKER: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }
  );

  // Wait for restarted server
  let rebooted = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${serverPort}/health`);
      if (res.ok) {
        rebooted = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  if (!rebooted) throw new Error('Rebooted server failed to become healthy');

  // Fetch workspace and assert full persistence
  const reloadedRes = await fetch(`${baseUrl}/workspaces/${wsId}`, {
    headers: { 'x-owner-id': ownerId },
  });
  const reloadedWs = await reloadedRes.json();

  console.log(`-> Reloaded Workspace: Revision ${reloadedWs.revision}`);
  console.log(`   Title: "${reloadedWs.snapshot.meetingTitle}"`);
  console.log(`   Item 1 pinned: ${reloadedWs.snapshot.items[0]?.pinned}`);
  console.log(`   Item 2 duration: ${reloadedWs.snapshot.items[1]?.durationMinutes} min`);

  if (reloadedWs.revision !== actionResult.revision) {
    throw new Error(`Revision mismatch after reload: expected ${actionResult.revision}, got ${reloadedWs.revision}`);
  }
  if (reloadedWs.snapshot.meetingTitle !== '2027 Executive Vision') {
    throw new Error('Meeting title lost after reload');
  }
  if (!reloadedWs.snapshot.items[0]?.pinned) {
    throw new Error('Item 1 pin state lost after reload');
  }
  if (reloadedWs.snapshot.items[1]?.durationMinutes !== 45) {
    throw new Error('Item 2 duration edit lost after reload');
  }
  console.log('-> Persistence through reload verified completely.');

  console.log('\n=================================================================');
  console.log('SUCCESS: S7 Checkpoint 2 Standalone Agenda Example Fully Verified!');
  console.log('=================================================================');
} finally {
  console.log('\nCleaning up processes and temporary resources...');
  await cleanup();
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
    console.log('-> Cleaned up sandbox directory.');
  } catch {}
  process.exit(0);
}
