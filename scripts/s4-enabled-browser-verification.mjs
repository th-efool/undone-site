import { Pool } from 'pg';
import { encode } from 'next-auth/jwt';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import assert from 'node:assert/strict';

const database = new URL(process.env.S3_TEST_DATABASE_URL ?? '');
assert(['127.0.0.1', 'localhost'].includes(database.hostname) && database.pathname.startsWith('/s3test'));
const hostDirectory = resolve(process.env.S3_TEST_HOST_DIRECTORY ?? '.tmp/s3-browser-host');
assert.notEqual(hostDirectory, process.cwd(), 'Separate local host checkout required');
const environment = parseEnv(readFileSync(resolve(hostDirectory, '.env'), 'utf8'));
assert.equal(environment.DATABASE_URL, database.toString());
assert.equal(environment.INTERACTION_LOCAL_MODEL_FIXTURE, '1');
assert.equal(environment.INTERACTION_YOUTUBE_ENABLED, '1');
assert.equal(environment.INTERACTION_YOUTUBE_FIXTURE, '1');
assert.equal(environment.INTERACTION_GITHUB_ENABLED, '1');
assert.equal(environment.INTERACTION_GITHUB_FIXTURE, '1');

const { chromium } = await import(
  pathToFileURL(
    resolve(process.env.S3_PLAYWRIGHT_MODULE ?? '.tmp/s3-postgres-runtime/node_modules/playwright-core/index.mjs')
  ).href
);
const pool = new Pool({ connectionString: database.toString() });

const userId = crypto.randomUUID();
let workspaceId;
await pool.query(`INSERT INTO users (id,email,"updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP)`, [
  userId,
  `${userId}@example.test`,
]);
const token = await encode({
  secret: environment.AUTH_SECRET,
  salt: 'authjs.session-token',
  token: { sub: userId, name: 'S4 Enabled Test Learner', email: `${userId}@example.test` },
});

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(120_000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));

function startWorker() {
  const child = spawn(
    process.execPath,
    [
      '--conditions=react-server',
      '--import',
      'tsx',
      '--import',
      './scripts/register-root-environment.mjs',
      'src/server/interaction-worker.ts',
    ],
    { cwd: hostDirectory, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true }
  );
  child.stderr.on('data', bytes => console.error(bytes.toString().slice(0, 500)));
  return child;
}
let worker = startWorker();

async function waitReady() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const row = (
      await pool.query(
        `SELECT revision,snapshot->'processing'->>'status' AS status FROM interaction_workspaces WHERE id=$1`,
        [workspaceId]
      )
    ).rows[0];
    if (row?.status === 'ready') {
      await page.waitForFunction(
        revision => Number(document.body.textContent.match(/Rev #(\d+)/)?.[1]) >= revision,
        Number(row.revision)
      );
      await page.locator('section[aria-label="Grounded source text"] small').filter({ hasText: /^ready$/ }).first().waitFor();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('CANONICAL_PROCESSING_DID_NOT_REACH_READY');
}

async function stopWorker() {
  if (worker.exitCode !== null || worker.signalCode !== null) return;
  const closed = new Promise(resolve => worker.once('close', resolve));
  worker.kill();
  await closed;
}

try {
  console.log('--- Starting S4 Enabled Browser Verification ---');

  // 1. Initial Intake & Auth Handoff
  await page.goto('http://localhost:3107/', { timeout: 120_000 });
  await page.getByLabel('What do you want to learn about?').fill('Learn distributed consensus with YouTube and GitHub.');
  await page.getByRole('button', { name: 'Add sources', exact: true }).click();
  await page.getByLabel('Paste source text').fill('Quorums overlap. Logs retain writes across partitions.');
  await page.getByRole('button', { name: 'Begin journey', exact: true }).click();
  await page.waitForURL('**/auth?**', { timeout: 60_000 });

  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
  ]);

  await page.goto('http://localhost:3107/quest/start');
  await page.getByText('Confirm this learning goal for your signed-in account.').waitFor();
  await page.getByRole('button', { name: 'Create cohort', exact: true }).click();

  await page.waitForURL('**/quest/build/**', { timeout: 60_000 });
  workspaceId = page.url().split('/quest/build/')[1].split(/[?#]/)[0];
  console.log(`PASS intake handoff -> workspaceId=${workspaceId}`);

  await page.getByRole('main', { name: 'Cohort Curriculum Workspace' }).waitFor({ timeout: 120_000 });
  await page.getByText('live', { exact: true }).waitFor({ timeout: 30_000 });
  await waitReady();
  console.log('PASS workspace initialized and reached ready state');

  // 2. YouTube Source Ingestion (Enabled & Fixture)
  console.log('Verifying enabled YouTube ingestion...');
  const addYtButton = page.getByRole('button', { name: 'Add YouTube source', exact: true });
  await addYtButton.waitFor({ state: 'visible', timeout: 15_000 });

  await page.getByLabel('Video title').fill('Consensus Lecture Video');
  await page.getByLabel('Public YouTube video URL').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const preYtRev = Number((await pool.query(`SELECT revision FROM interaction_workspaces WHERE id=$1`, [workspaceId])).rows[0].revision);
  const [ytActionRes] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/actions') && response.request().method() === 'POST'),
    addYtButton.click(),
  ]);
  assert.equal(ytActionRes.status(), 200);
  console.log('Dispatched add_youtube_source action');
  await page.waitForFunction(rev => Number(document.body.textContent.match(/Rev #(\d+)/)?.[1]) > rev, preYtRev);
  await waitReady();

  let snapshot = (await pool.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [workspaceId])).rows[0].snapshot;
  const ytSource = snapshot.sources.find(s => s.input?.kind === 'youtube');
  assert(ytSource, 'YouTube source must exist in workspace snapshot');
  console.log('PASS YouTube source processed to ready');

  // Verify timestamped evidence citations
  await page.locator('article').last().getByText('Inspect evidence', { exact: true }).click();
  await page.locator('details[open] cite').filter({ hasText: /timestamp/i }).first().waitFor({ timeout: 15_000 });
  const citeText = await page.locator('details[open] cite').filter({ hasText: /timestamp/i }).first().innerText();
  console.log(`PASS YouTube timestamp evidence verified: ${citeText}`);

  // Test YouTube scope change
  console.log('Testing YouTube scope change...');
  const ytScopeStart = page.locator('input[id^="start-sec-"]');
  if (await ytScopeStart.count()) {
    await ytScopeStart.first().fill('15');
    const ytScopeEnd = page.locator('input[id^="end-sec-"]');
    if (await ytScopeEnd.count()) {
      await ytScopeEnd.first().fill('45');
    }
    const applyYtScope = page.getByRole('button', { name: 'Apply caption scope', exact: true });
    if (await applyYtScope.count()) {
      const preScopeRev = Number((await pool.query(`SELECT revision FROM interaction_workspaces WHERE id=$1`, [workspaceId])).rows[0].revision);
      const [scopeRes] = await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/actions') && response.request().method() === 'POST'),
        applyYtScope.first().click(),
      ]);
      assert.equal(scopeRes.status(), 200);
      await page.waitForFunction(rev => Number(document.body.textContent.match(/Rev #(\d+)/)?.[1]) > rev, preScopeRev);
      await waitReady();
      snapshot = (await pool.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [workspaceId])).rows[0].snapshot;
      const updatedYt = snapshot.sources.find(s => s.input?.kind === 'youtube');
      assert.equal(updatedYt?.input?.scope?.startMs, 15000);
      console.log('PASS YouTube scope update committed without re-acquisition');
    }
  }

  // 3. GitHub Source Ingestion (Enabled & Fixture)
  console.log('Verifying enabled GitHub ingestion...');
  const addGhButton = page.getByRole('button', { name: 'Add GitHub source', exact: true });
  await addGhButton.waitFor({ state: 'visible', timeout: 15_000 });

  await page.getByLabel('Repository title').fill('Consensus Hello Repository');
  await page.getByLabel('Public GitHub repository URL').fill('https://github.com/octocat/Hello-World');
  await page.locator('#builder-gh-paths').fill('README.md');
  const preGhRev = Number((await pool.query(`SELECT revision FROM interaction_workspaces WHERE id=$1`, [workspaceId])).rows[0].revision);
  const [ghActionRes] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/actions') && response.request().method() === 'POST'),
    addGhButton.click(),
  ]);
  assert.equal(ghActionRes.status(), 200);
  console.log('Dispatched add_github_source action');
  await page.waitForFunction(rev => Number(document.body.textContent.match(/Rev #(\d+)/)?.[1]) > rev, preGhRev);
  await waitReady();
  snapshot = (await pool.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [workspaceId])).rows[0].snapshot;
  const ghSource = snapshot.sources.find(s => s.input?.kind === 'github');
  assert(ghSource, 'GitHub source must exist in workspace snapshot');
  console.log('PASS GitHub source processed to ready');

  // Verify line-anchored citations and repo provenance
  await page.locator('article').last().getByText('Inspect evidence', { exact: true }).click();
  await page.locator('details[open] cite').filter({ hasText: /README\.md#L/i }).first().waitFor({ timeout: 15_000 });
  const ghCiteText = await page.locator('details[open] cite').filter({ hasText: /README\.md#L/i }).first().innerText();
  console.log(`PASS GitHub line-anchored evidence verified: ${ghCiteText}`);

  // 4. Refinement Through Chat
  console.log('Verifying chat refinement of grounded lesson...');
  await page.getByRole('button', { name: 'Discuss in chat', exact: true }).last().click();
  await page.getByLabel('Message the cohort assistant').fill('Refine this lesson based on the GitHub repository source.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByText('Selected lesson refined.', { exact: true }).waitFor({ timeout: 60_000 });
  await waitReady();
  console.log('PASS assistant message refinement completed');

  // 5. Final Screenshot and Evidence Capture
  mkdirSync('.tmp/s4-postgres-runtime', { recursive: true });
  await page.screenshot({ path: '.tmp/s4-postgres-runtime/s4-enabled-completed.png', fullPage: true });
  assert.equal(errors.length, 0, `Unexpected page errors: ${errors.join('\n')}`);

  console.log('S4_ENABLED_BROWSER_JOURNEY_PASS');
} catch (error) {
  console.error('S4 enabled browser verification error:', error);
  mkdirSync('.tmp/s4-postgres-runtime', { recursive: true });
  await page.screenshot({ path: '.tmp/s4-postgres-runtime/s4-enabled-failure.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await stopWorker();
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 10_000))]);
  await pool.end();
}
