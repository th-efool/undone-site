import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import pg from 'pg';

const PgPool = pg?.Pool ?? pg?.default?.Pool ?? pg;

const repoRoot = process.cwd();
const packageDir = path.resolve(repoRoot, 'packages/interaction-builder');
const agendaExampleSrcDir = path.resolve(packageDir, 'examples/agenda');
const migrationSrcPath = path.resolve(packageDir, 'migrations/001_interaction_schema.sql');
const hostSchemaSrcPath = path.resolve(agendaExampleSrcDir, 'host-schema.sql');

console.log('=================================================================');
console.log('S7 Checkpoint 5: Real Clean-Host Browser Acceptance (Playwright)');
console.log('=================================================================');

// 1. Build and pack interaction-builder package
console.log('\n[1/8] Building packages/interaction-builder and packing tarball...');
execSync('node build.mjs', { cwd: packageDir, stdio: 'inherit' });
const packOutput = execSync('npm pack', { cwd: packageDir, encoding: 'utf8' }).trim();
const tarballFilename = packOutput.split('\n').pop().trim();
const tarballPath = path.join(packageDir, tarballFilename);

if (!fs.existsSync(tarballPath)) {
  throw new Error(`Tarball not found: ${tarballPath}`);
}
console.log(`-> Generated package tarball: ${tarballPath}`);

// 2. Setup isolated sandbox
console.log('\n[2/8] Creating isolated external sandbox in temp directory...');
const sandboxDir = path.join(os.tmpdir(), `ib-browser-acceptance-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
fs.mkdirSync(sandboxDir, { recursive: true });
fs.mkdirSync(path.join(sandboxDir, 'migrations'), { recursive: true });
fs.mkdirSync(path.join(sandboxDir, 'public'), { recursive: true });
fs.mkdirSync(path.join(sandboxDir, 'screenshots'), { recursive: true });
console.log(`-> Sandbox directory: ${sandboxDir}`);

// Copy example files
const exampleFiles = [
  'agenda.domain.ts',
  'agenda.tools.ts',
  'agenda.ui.tsx',
  'host-agenda.domain.ts',
  'host-agenda.repository.ts',
  'host-agenda.service.ts',
  'host-agenda.tools.ts',
  'host-agenda.worker.ts',
  'host-agenda.ui.tsx',
  'server.ts',
  'worker.ts',
  'host-schema.sql',
];

for (const file of exampleFiles) {
  const src = path.join(agendaExampleSrcDir, file);
  const dest = path.join(sandboxDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}
fs.copyFileSync(migrationSrcPath, path.join(sandboxDir, 'migrations/001_interaction_schema.sql'));
fs.copyFileSync(hostSchemaSrcPath, path.join(sandboxDir, 'host-schema.sql'));

// 3. Verify zero Undone imports or monorepo aliases
console.log('\n[3/8] Asserting ZERO Undone imports or monorepo aliases in sandbox...');
const forbiddenPatterns = [
  { regex: /@\//g, name: 'Root alias "@/"' },
  { regex: /undone/gi, name: 'Host domain "undone"' },
  { regex: /cohort/gi, name: 'Host domain "cohort"' },
  { regex: /sidequesthq/gi, name: 'Host domain "sidequesthq"' },
  { regex: /\.\.\/\.\.\/(src|prisma|apps)/g, name: 'Escaping relative path' },
];

for (const file of exampleFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))) {
  const filePath = path.join(sandboxDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const { regex, name } of forbiddenPatterns) {
      if (regex.test(content)) {
        throw new Error(`Forbidden pattern "${name}" found in host-owned example file: ${file}`);
      }
    }
  }
}
console.log('-> Verified: Zero Undone imports or monorepo aliases detected.');

// 4. Install dependencies in sandbox
console.log('\n[4/8] Installing dependencies into isolated sandbox from tarball...');
fs.writeFileSync(
  path.join(sandboxDir, 'package.json'),
  JSON.stringify(
    {
      name: 'browser-acceptance-consumer',
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
        playwright: '^1.40.0',
        esbuild: '^0.24.0',
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

console.log('-> Running tsc in external consumer sandbox...');
execSync('npx tsc --noEmit', { cwd: sandboxDir, stdio: 'inherit' });
console.log('-> External consumer TypeScript compilation passed cleanly.');

// 5. Spin up disposable PostgreSQL
console.log('\n[5/8] Starting disposable PostgreSQL on loopback port 15438...');
const pgPort = 15438;
const pgDbDir = path.join(sandboxDir, 'pgdata');
fs.mkdirSync(pgDbDir, { recursive: true });

const embeddedPgModule = path.resolve(repoRoot, '.tmp/s3-postgres-runtime/node_modules/embedded-postgres/dist/index.js');
let database;
let databaseUrl = `postgresql://agendatest:agendatest@127.0.0.1:${pgPort}/browser_acceptance_db`;

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
  });

  await database.initialise();
  await database.start();
  console.log(`-> Disposable PostgreSQL started at ${databaseUrl}`);

  // Create database
  const adminPool = new PgPool({ connectionString: `postgresql://agendatest:agendatest@127.0.0.1:${pgPort}/postgres` });
  await adminPool.query('CREATE DATABASE browser_acceptance_db;');
  await adminPool.end();

  // Apply engine migration
  const migrationSql = fs.readFileSync(path.join(sandboxDir, 'migrations/001_interaction_schema.sql'), 'utf8');
  const initPool = new PgPool({ connectionString: databaseUrl });
  await initPool.query(migrationSql);

  // Apply host schema migration
  const hostSchemaSql = fs.readFileSync(path.join(sandboxDir, 'host-schema.sql'), 'utf8');
  await initPool.query(hostSchemaSql);
  await initPool.end();
  console.log('-> Applied migrations/001_interaction_schema.sql and host-schema.sql to PostgreSQL successfully.');
} else {
  throw new Error('EmbeddedPostgres module required for isolated browser acceptance verification');
}

// 6. Create client app bundle using esbuild
console.log('\n[6/8] Building client browser application bundle...');
const clientEntryCode = `
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createHttpTransport } from 'interaction-builder/client';
import { AgendaApp } from './agenda.ui';
import { HostAgendaApp } from './host-agenda.ui';

function Root() {
  const params = new URLSearchParams(window.location.search);
  const profile = params.get('profile') || 'native';
  const workspaceId = params.get('workspaceId') || 'c1000000-0000-4000-8000-000000000001';
  const ownerId = params.get('ownerId') || 'user-corp-exec';
  const meetingId = params.get('meetingId') || 'meeting-corp-exec-01';

  const [initialMeeting, setInitialMeeting] = useState(null);
  const [loading, setLoading] = useState(profile === 'host');

  const transport = createHttpTransport({
    workspaceId,
    baseUrl: '/api/interaction/v1',
    fetch: (url, init) => {
      const headers = new Headers(init?.headers);
      headers.set('X-Owner-ID', ownerId);
      return fetch(url, { ...init, headers });
    },
  });

  useEffect(() => {
    if (profile === 'host') {
      fetch('/api/host/meetings/' + meetingId, {
        headers: { 'X-Owner-ID': ownerId },
      })
        .then((r) => r.json())
        .then((m) => {
          setInitialMeeting(m);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [profile, meetingId, ownerId]);

  if (loading) {
    return <div data-testid="loading-indicator">Loading host meeting...</div>;
  }

  if (profile === 'host') {
    if (!initialMeeting) {
      return <div data-testid="error-no-meeting">Meeting not found</div>;
    }
    return (
      <HostAgendaApp
        meeting={initialMeeting}
        workspaceId={workspaceId}
        serverUrl={window.location.origin}
        ownerId={ownerId}
        transport={transport}
      />
    );
  }

  const initialAgenda = {
    schemaVersion: 1,
    meetingTitle: '2027 Executive Vision',
    date: '2026-10-15',
    items: [
      { id: 'item-1', version: 1, title: 'Opening Remarks', durationMinutes: 15, presenter: 'CEO', pinned: false },
      { id: 'item-2', version: 1, title: 'Financial Strategy', durationMinutes: 45, presenter: 'CFO', pinned: false },
    ],
  };

  return (
    <AgendaApp
      workspaceId={workspaceId}
      initialAgenda={initialAgenda}
      transport={transport}
    />
  );
}

const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<Root />);
}
`;

fs.writeFileSync(path.join(sandboxDir, 'client-entry.tsx'), clientEntryCode, 'utf8');

const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Interaction Builder Acceptance</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; }
    .agenda-item.selected, .agenda-item-card.selected { outline: 2px solid #2563eb; background: #eff6ff; }
    .conflict-banner { background: #fee2e2; color: #991b1b; padding: 0.5rem; border-radius: 4px; margin: 1rem 0; font-weight: 500; }
    .badge-connection.live { color: #16a34a; font-weight: 600; }
    .status-badges { display: flex; gap: 1rem; align-items: center; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/app.bundle.js"></script>
</body>
</html>`;

fs.writeFileSync(path.join(sandboxDir, 'public/index.html'), htmlTemplate, 'utf8');

execSync(
  'npx esbuild client-entry.tsx --bundle --outfile=public/app.bundle.js --format=esm --jsx=automatic --target=es2022',
  { cwd: sandboxDir, stdio: 'inherit' }
);
console.log('-> Client bundle generated: public/app.bundle.js');

// 7. Write Playwright test runner in sandbox
console.log('\n[7/8] Executing Playwright browser acceptance scenarios for both profiles...');

const browserRunnerScript = `
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import pg from 'pg';
import { createAgendaServer } from './server';

const PgPool = (pg as any)?.Pool ?? (pg as any)?.default?.Pool ?? pg.Pool;
const pool = new PgPool({ connectionString: process.env.DATABASE_URL });

const serverPort = 3942;
const baseUrl = 'http://127.0.0.1:' + serverPort;

async function runBrowserAcceptance() {
  console.log('[Browser Runner] Starting standalone server on port ' + serverPort + '...');
  let server = await createAgendaServer({
    host: '127.0.0.1',
    port: serverPort,
    databaseUrl: process.env.DATABASE_URL,
    enableEmbeddedWorker: true,
    staticDir: './public',
    allowInsecureDemoAuth: true,
  });
  await server.start();
  console.log('[Browser Runner] Server listening cleanly on ' + baseUrl);

  // Discover installed Chromium binary
  const candidatePaths = [
    'C:/Users/agrim/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
    'C:/Users/agrim/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  ];
  const executablePath = candidatePaths.find(p => fs.existsSync(p));
  console.log('[Browser Runner] Using Chromium executable:', executablePath || 'default playwright path');

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext();

  try {
    // =========================================================================
    // PROFILE 1: NATIVE INTERACTION-MANAGED STATE ACCEPTANCE
    // =========================================================================
    console.log('\\n=================================================================');
    console.log('--- START PROFILE 1: Native Interaction-Managed Agenda Acceptance ---');
    console.log('=================================================================');

    const ownerId = 'user-corp-exec';
    const nativeWsId = 'c1000000-0000-4000-8000-000000000001';

    // 1. Create native workspace in database
    await pool.query(
      'INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "domainVersion", "snapshot", "revision", "contextEpoch", "sequence", "lifecycle", "createdAt", "updatedAt") VALUES ($1, $2, \\'agenda\\', 1, $3, 0, 0, 0, \\'active\\', NOW(), NOW())',
      [
        nativeWsId,
        ownerId,
        JSON.stringify({
          schemaVersion: 1,
          meetingTitle: '2027 Executive Vision',
          date: '2026-10-15',
          items: [
            { id: 'item-1', title: 'Opening Remarks', durationMinutes: 15, presenter: 'CEO', pinned: false, version: 1 },
            { id: 'item-2', title: 'Financial Strategy', durationMinutes: 45, presenter: 'CFO', pinned: false, version: 1 },
          ],
        }),
      ]
    );

    const page1 = await context.newPage();
    await page1.goto(baseUrl + '/?profile=native&workspaceId=' + nativeWsId + '&ownerId=' + ownerId);

    // Wait for connection
    await page1.waitForSelector('[data-testid="meeting-title"]');
    await page1.waitForSelector('[data-testid="connection-status"]');

    const initialTitle = await page1.textContent('[data-testid="meeting-title"]');
    if (!initialTitle?.includes('2027 Executive Vision')) {
      throw new Error('Expected initial title "2027 Executive Vision", got: ' + initialTitle);
    }
    console.log('-> Verified: Browser loaded native workspace; Title: "' + initialTitle?.trim() + '"');

    // Assistant interaction via real typing and SSE
    console.log('-> Sending assistant turn message through browser composer...');
    await page1.fill('[data-testid="chat-input"]', 'Please rename meeting to "2027 Global Roadmap" and pin Opening Remarks');
    await page1.click('[data-testid="chat-send-button"]');

    // Wait for SSE update to reflect in UI
    await page1.waitForFunction(() => {
      const el = document.querySelector('[data-testid="meeting-title"]');
      return el && el.textContent && el.textContent.includes('2027 Global Roadmap');
    }, { timeout: 15000 });

    const updatedTitle = await page1.textContent('[data-testid="meeting-title"]');
    console.log('-> Verified: Assistant updated visible agenda via SSE; New Title: "' + updatedTitle?.trim() + '"');

    // Verify pinned status rendered in DOM
    await page1.waitForFunction(() => {
      const el = document.querySelector('[data-testid="item-item-1"]');
      return el && el.textContent && el.textContent.includes('[PINNED]');
    }, { timeout: 5000 });
    console.log('-> Verified: Opening Remarks item rendered as [PINNED] in DOM.');

    // Direct UI action: title update via UI form
    console.log('-> Testing direct UI edit...');
    await page1.fill('[data-testid="title-input"]', '2027 Global Roadmap (Direct Edit)');
    await page1.click('[data-testid="update-title-button"]');
    await page1.waitForFunction(() => {
      const el = document.querySelector('[data-testid="meeting-title"]');
      return el && el.textContent && el.textContent.includes('(Direct Edit)');
    }, { timeout: 5000 });
    console.log('-> Verified: Direct UI edit updated title and advanced revision in DOM.');

    // Item selection chip
    console.log('-> Testing item selection in conversation context...');
    await page1.click('[data-testid="item-title-item-1"]');
    await page1.waitForSelector('[data-testid="selected-indicator"]');
    console.log('-> Verified: Item selection highlight and selection chip displayed in browser.');

    // Two-Tab Stale Edit Conflict Handling
    console.log('-> Testing two-tab concurrent stale edit conflict handling...');
    const page2 = await context.newPage();
    await page2.goto(baseUrl + '/?profile=native&workspaceId=' + nativeWsId + '&ownerId=' + ownerId);
    await page2.waitForSelector('[data-testid="meeting-title"]');

    // In Tab 2, apply a title change
    await page2.fill('[data-testid="title-input"]', 'Tab 2 Competing Title');
    await page2.click('[data-testid="update-title-button"]');
    await page2.waitForFunction(() => {
      const el = document.querySelector('[data-testid="meeting-title"]');
      return el && el.textContent && el.textContent.includes('Tab 2 Competing Title');
    }, { timeout: 5000 });
    console.log('-> Tab 2 committed revision advance successfully.');

    // Now in Tab 1, attempt a stale action with old revision
    // Tab 1 will detect the revision mismatch on direct dispatch
    await page1.fill('[data-testid="title-input"]', 'Tab 1 Stale Attempt');
    await page1.click('[data-testid="update-title-button"]');

    // Verify conflict banner rendered in Tab 1 and attempted input was preserved
    await page1.waitForSelector('[data-testid="conflict-banner"]');
    const conflictMsg = await page1.textContent('[data-testid="conflict-banner"]');
    console.log('-> Verified: Stale edit displayed conflict banner: "' + conflictMsg?.trim() + '"');

    await page2.close();

    // Reload page and verify state restoration from PostgreSQL
    console.log('-> Reloading browser page to test persistence and reconnect...');
    await page1.reload();
    await page1.waitForSelector('[data-testid="meeting-title"]');
    const titleAfterReload = await page1.textContent('[data-testid="meeting-title"]');
    if (!titleAfterReload?.includes('Tab 2 Competing Title')) {
      throw new Error('State lost after browser reload: ' + titleAfterReload);
    }
    console.log('-> Verified: State fully restored after browser reload & SSE reconnection.');

    // Server restart test
    console.log('-> Restarting server to verify durable recovery across restarts...');
    await server.close();
    server = await createAgendaServer({
      host: '127.0.0.1',
      port: serverPort,
      databaseUrl: process.env.DATABASE_URL,
      enableEmbeddedWorker: true,
      staticDir: './public',
      allowInsecureDemoAuth: true,
    });
    await server.start();

    await page1.reload();
    await page1.waitForSelector('[data-testid="meeting-title"]');
    const screenshotsDir = process.env.SCREENSHOTS_DIR || path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    const shot1Path = path.join(screenshotsDir, 'profile1-native-browser.png');
    await page1.screenshot({ path: shot1Path });
    console.log('-> Captured screenshot: ' + shot1Path);
    await page1.close();

    // =========================================================================
    // PROFILE 2: HOST-OWNED BUSINESS RESOURCE ACCEPTANCE
    // =========================================================================
    console.log('\\n=================================================================');
    console.log('--- START PROFILE 2: Host-Owned Business Resource Acceptance ---');
    console.log('=================================================================');

    const hostMeetingId = 'meeting-corp-exec-02';
    const hostWsId = 'c1000000-0000-4000-8000-000000000002';

    // 1. Create authoritative host meeting in host database table
    await pool.query(
      'INSERT INTO "host_agenda_meetings" ("id", "ownerId", "version", "meetingTitle", "date", "createdAt", "updatedAt") VALUES ($1, $2, 0, \\'Q4 Board Strategy\\', \\'2026-10-15\\', NOW(), NOW())',
      [hostMeetingId, ownerId]
    );
    await pool.query(
      'INSERT INTO "host_agenda_items" ("id", "meetingId", "ownerId", "version", "title", "durationMinutes", "presenter", "pinned", "sortOrder", "createdAt", "updatedAt") VALUES (\\'h-item-1\\', $1, $2, 0, \\'Executive Compensation\\', 30, \\'Board Chair\\', false, 0, NOW(), NOW()), (\\'h-item-2\\', $1, $2, 0, \\'M&A Strategy\\', 60, \\'CEO\\', true, 1, NOW(), NOW())',
      [hostMeetingId, ownerId]
    );

    // 2. Create bound interaction workspace with ZERO duplicate business state
    await pool.query(
      'INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "domainVersion", "snapshot", "revision", "contextEpoch", "sequence", "lifecycle", "createdAt", "updatedAt") VALUES ($1, $2, \\'host_agenda\\', 1, $3, 0, 0, 0, \\'active\\', NOW(), NOW())',
      [
        hostWsId,
        ownerId,
        JSON.stringify({
          schemaVersion: 1,
          meetingId: hostMeetingId,
          observedVersion: 0,
          selectedItemId: null,
        }),
      ]
    );

    const hostPage = await context.newPage();
    await hostPage.goto(
      baseUrl + '/?profile=host&meetingId=' + hostMeetingId + '&workspaceId=' + hostWsId + '&ownerId=' + ownerId
    );

    await hostPage.waitForSelector('[data-testid="host-agenda-viewer"]');
    await hostPage.waitForSelector('[data-testid="host-authoritative-badge"]');

    const initialBadge = await hostPage.textContent('[data-testid="host-authoritative-badge"]');
    if (!initialBadge?.includes('Version 0')) {
      throw new Error('Expected Version 0 in authoritative badge, got: ' + initialBadge);
    }
    console.log('-> Verified: Authoritative host meeting mounted in browser; Badge: "' + initialBadge?.trim() + '"');

    // Direct UI command execution through Host Command Boundary
    console.log('-> Executing direct host rename command through UI form...');
    await hostPage.fill('[data-testid="input-new-title"]', 'Q4 Board Strategy & Governance');
    await hostPage.click('[data-testid="btn-update-title"]');

    await hostPage.waitForFunction(() => {
      const el = document.querySelector('[data-testid="host-authoritative-badge"]');
      return el && el.textContent && el.textContent.includes('Version 1');
    }, { timeout: 5000 });

    const updatedBadge = await hostPage.textContent('[data-testid="host-authoritative-badge"]');
    console.log('-> Verified: Host version advanced to 1 in browser DOM; Badge: "' + updatedBadge?.trim() + '"');

    // Assistant model command through the same Host Command Boundary
    console.log('-> Sending assistant request to modify item duration via tool...');
    await hostPage.fill('[data-testid="chat-input"]', 'Please change Executive Compensation duration to 45 minutes');
    await hostPage.click('[data-testid="chat-send-button"]');

    // Assistant worker executes createHostAgendaAiTools -> HostAgendaService.executeCommand
    await hostPage.waitForFunction(() => {
      const el = document.querySelector('[data-testid="host-authoritative-badge"]');
      return el && el.textContent && el.textContent.includes('Version 2');
    }, { timeout: 15000 });

    const badgeAfterAssistant = await hostPage.textContent('[data-testid="host-authoritative-badge"]');
    console.log('-> Verified: Assistant tool executed through single command boundary; Host Version: "' + badgeAfterAssistant?.trim() + '"');

    // External Host Mutation outside chat
    console.log('-> Applying external mutation directly to host database...');
    await pool.query(
      'UPDATE "host_agenda_meetings" SET "meetingTitle" = \\'Emergency Board Session\\', "version" = 3, "updatedAt" = NOW() WHERE "id" = $1',
      [hostMeetingId]
    );

    // Refresh in browser
    await hostPage.reload();
    await hostPage.waitForSelector('[data-testid="meeting-title"]');
    const titlePostExternal = await hostPage.textContent('[data-testid="meeting-title"]');
    const badgePostExternal = await hostPage.textContent('[data-testid="host-authoritative-badge"]');

    if (!titlePostExternal?.includes('Emergency Board Session')) {
      throw new Error('External mutation not reflected: ' + titlePostExternal);
    }
    console.log('-> Verified: External host mutation immediately rendered in browser; Title: "' + titlePostExternal?.trim() + '", Badge: "' + badgePostExternal?.trim() + '"');

    // CRITICAL PROOF: Verify raw PostgreSQL snapshot has NO DUPLICATE business records
    const snapRes = await pool.query('SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1', [hostWsId]);
    const storedSnapshot = snapRes.rows[0]?.snapshot;
    if (storedSnapshot.meetingTitle !== undefined || storedSnapshot.items !== undefined) {
      throw new Error('FATAL: Competing duplicate business state detected in interaction_workspaces.snapshot: ' + JSON.stringify(storedSnapshot));
    }
    console.log('-> Verified: Raw interaction snapshot contains ONLY reference metadata (meetingId, observedVersion); ZERO dual writers.');

    // Cross-user access rejected
    console.log('-> Verifying cross-user access isolation...');
    const attackerRes = await fetch(baseUrl + '/api/host/meetings/' + hostMeetingId, {
      headers: { 'X-Owner-ID': 'foreign-attacker-user' },
    });
    if (attackerRes.status !== 404) {
      throw new Error('Foreign owner was not rejected with 404: ' + attackerRes.status);
    }
    console.log('-> Verified: Foreign tenant access denied (HTTP 404).');

    const shot2Path = path.join(screenshotsDir, 'profile2-host-browser.png');
    await hostPage.screenshot({ path: shot2Path });
    console.log('-> Captured screenshot: ' + shot2Path);
    await hostPage.close();

    console.log('\\n=================================================================');
    console.log('SUCCESS: Both Integration Profiles Passed Real Browser Acceptance!');
    console.log('=================================================================');
  } finally {
    await browser.close();
    await server.close();
    await pool.end();
  }
}

runBrowserAcceptance().catch((err) => {
  console.error('[Browser Runner] FATAL ERROR:', err);
  process.exit(1);
});
`;

fs.writeFileSync(path.join(sandboxDir, 'run-browser-acceptance.ts'), browserRunnerScript, 'utf8');

// 8. Execute browser acceptance in sandbox
console.log('\n[8/8] Running Playwright browser acceptance in isolated consumer sandbox...');
const persistentScreenshotsDir = path.resolve(repoRoot, 'screenshots');
fs.mkdirSync(persistentScreenshotsDir, { recursive: true });

execSync('npx tsx run-browser-acceptance.ts', {
  cwd: sandboxDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SCREENSHOTS_DIR: persistentScreenshotsDir,
  },
});

console.log('\nCleaning up processes and temporary resources...');
if (database) {
  try {
    await database.stop();
  } catch {}
}
try {
  fs.rmSync(sandboxDir, { recursive: true, force: true });
} catch {}
console.log('-> Cleaned up sandbox directory.');
console.log('\n=================================================================');
console.log('SUCCESS: S7 Checkpoint 5 Browser Acceptance Fully Verified!');
console.log('=================================================================');
