import { Pool } from 'pg';
import { encode } from 'next-auth/jwt';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import assert from 'node:assert/strict';
const database = new URL(process.env.S3_TEST_DATABASE_URL ?? '');
assert(['127.0.0.1','localhost'].includes(database.hostname) && database.pathname.startsWith('/s3test'));
const hostDirectory = resolve(process.env.S3_TEST_HOST_DIRECTORY ?? '.tmp/s3-browser-host');
assert.notEqual(hostDirectory, process.cwd(), 'Separate local host checkout required');
const environment = parseEnv(readFileSync(resolve(hostDirectory, '.env'), 'utf8'));
assert.equal(environment.DATABASE_URL, database.toString());
assert.equal(environment.INTERACTION_LOCAL_MODEL_FIXTURE, '1');
const { chromium } = await import(pathToFileURL(resolve(process.env.S3_PLAYWRIGHT_MODULE ?? '.tmp/s3-postgres-runtime/node_modules/playwright-core/index.mjs')).href);
const pool = new Pool({ connectionString: database.toString() });
await pool.query(readFileSync('prisma/interaction-runs-and-journal.sql', 'utf8'));
const userId = crypto.randomUUID(), workspaceId = crypto.randomUUID();
await pool.query(`INSERT INTO users (id,email,"updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP)`, [userId, `${userId}@example.test`]);
const token = await encode({ secret: environment.AUTH_SECRET, salt: 'authjs.session-token',
  token: { sub: userId, name: 'S3 Test Learner', email: `${userId}@example.test` } });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies([{ name: 'authjs.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', secure: false }]);
const page = await context.newPage();
page.setDefaultTimeout(120_000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
function startWorker() {
  const child = spawn(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--import', './scripts/register-root-environment.mjs', 'src/server/interaction-worker.ts'],
    { cwd: hostDirectory, stdio: ['ignore','ignore','pipe'], windowsHide: true });
  child.stderr.on('data', bytes => console.error(bytes.toString().slice(0, 500)));
  return child;
}
let worker = startWorker();
const waitReady = () => page.locator('section[aria-label="Grounded source text"] small').filter({ hasText:/^ready$/ }).waitFor({ timeout:120_000 });
async function stopWorker() {
  if (worker.exitCode !== null) return;
  const closed = new Promise(resolve => worker.once('close', resolve));
  worker.kill(); await closed;
}
try {
  await page.goto(`http://localhost:3107/quest/build/${workspaceId}`, { timeout: 120_000 });
  await page.getByRole('main', { name: 'Cohort Curriculum Workspace' }).waitFor({ timeout: 120_000 });
  await page.getByText('live', { exact: true }).waitFor({ timeout: 30_000 });
  assert(page.url().includes('/quest/build/'));
  await page.getByLabel('Source title').fill('Consensus notes');
  await page.getByLabel('Paste text to retain and ground this curriculum').fill('Quorums overlap. Logs retain writes.');
  await page.getByRole('button', { name: 'Add text source', exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes('Consensus notes'));
  console.log(`BROWSER_AUTH_AND_INTAKE_PASS workspace=${workspaceId}`);
  await page.getByPlaceholder('Type an instruction or request...').fill('Help me learn quorum overlap.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.getByText('Learning goal saved.', { exact: true }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll('main[aria-label="Cohort Curriculum Workspace"] article').length === 2, undefined, { timeout:120_000 });
  console.log('PASS authenticated chat goal and grounded lesson generation');
  assert((await page.locator('main').innerText()).includes('Quorums overlap.'));
  await page.getByRole('button', { name: 'Discuss in chat' }).first().click();
  await page.getByPlaceholder('Type an instruction or request...').fill('Shorten this objective.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.getByText('Selected lesson refined.', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText('Explain quorum overlap.', { exact: true }).waitFor();
  console.log('PASS selected lesson refinement through actual worker/model tool loop');
  await waitReady();
  await page.getByRole('button', { name: 'Pin lesson', exact: true }).first().click();
  await page.getByRole('button', { name: 'Unpin lesson', exact: true }).waitFor();
  await waitReady();
  await page.getByRole('button', { name: 'Edit lesson', exact: true }).nth(1).click();
  const modal = page.locator('[class*="modalCard"]');
  await modal.locator('textarea').fill('My manual objective for retained writes.');
  await page.getByRole('button', { name: 'Update Lesson' }).click();
  await page.getByText('My manual objective for retained writes.', { exact: true }).waitFor();
  await waitReady();
  await page.reload();
  await page.getByText('My manual objective for retained writes.', { exact: true }).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Unpin lesson', exact: true }).waitFor();
  await waitReady();
  console.log('PASS reload preserves transcript, manual edits and pins');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Paste text to retain and ground this curriculum').fill('Quorums intersect. Logs retain writes.');
  await page.getByRole('button', { name: 'Save source changes' }).click();
  await page.waitForFunction(() => document.querySelectorAll('main[aria-label="Cohort Curriculum Workspace"] article').length === 4, undefined, { timeout:120_000 });
  assert((await page.locator('main').innerText()).includes('references changed or removed source text'));
  console.log('PASS changed source scope regenerates with orphaned authored work preserved');
  await stopWorker();
  await page.getByLabel('Source title').fill('Retry source');
  await page.getByLabel('Paste text to retain and ground this curriculum').fill('Retries reuse checkpoints.');
  await page.getByRole('button', { name: 'Add text source', exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes('Retry source'));
  let raw;
  for (let i=0; i<10 && !raw; i++) {
    const tick = spawnSync(process.execPath, ['--conditions=react-server','--import','tsx','scripts/s3-text-worker-once.ts'],
      { env: { ...process.env, S3_TEST_DATABASE_URL:database.toString() }, encoding:'utf8', timeout:30_000, windowsHide:true });
    assert.equal(tick.status, 0, tick.stderr);
    raw = (await pool.query(`SELECT a.id,a.body FROM cohort_text_artifacts a JOIN interaction_workspaces w ON w.id=a."workspaceId"
      WHERE a."workspaceId"=$1 AND a.kind='source_raw' AND a."sourceId" IN
      (SELECT item->>'id' FROM jsonb_array_elements(w.snapshot->'sources') item WHERE item->>'label'='Retry source')`, [workspaceId])).rows[0];
  }
  assert(raw, 'Acquisition checkpoint required before restart');
  const corrupted = Buffer.from(raw.body); corrupted[0] ^= 1;
  await pool.query(`UPDATE cohort_text_artifacts SET body=$1 WHERE id=$2`, [corrupted,raw.id]);
  worker = startWorker();
  await page.getByRole('button', { name:'Retry understanding', exact:true }).waitFor({ timeout:30_000 });
  await pool.query(`UPDATE cohort_text_artifacts SET body=$1 WHERE id=$2`, [raw.body,raw.id]);
  await page.getByRole('button', { name:'Retry understanding', exact:true }).click();
  await page.waitForFunction(() => document.querySelectorAll('main[aria-label="Cohort Curriculum Workspace"] article').length === 5, undefined, { timeout:60_000 });
  console.log('PASS actual worker restart, visible per-source failure, targeted retry and recovery');
  await context.setOffline(true);
  await page.getByText('reconnecting', { exact: true }).waitFor({ timeout: 30_000 });
  await context.setOffline(false);
  await page.getByText('live', { exact: true }).waitFor({ timeout: 30_000 });
  const second = await context.newPage();
  await second.goto(page.url());
  await second.getByText('My manual objective for retained writes.', { exact: true }).waitFor();
  await second.getByText('live', { exact: true }).waitFor({ timeout: 30_000 });
  console.log('PASS reconnect and second authenticated tab resume');
  await second.getByLabel('Source title').fill('Unsent local source title');
  assert.equal(await second.getByLabel('Source title').inputValue(), 'Unsent local source title');
  const endpoint = `http://localhost:3107/api/interaction/v1/workspaces/${workspaceId}`;
  const snapshot = await (await context.request.get(endpoint)).json();
  const conflict = await Promise.all([page, second].map(async (_tab, index) => {
    const actionId = crypto.randomUUID();
    const result = await context.request.post(`${endpoint}/actions`, { timeout: 30_000, headers: { 'idempotency-key':actionId },
      data: { actionId, workspaceId, expectedRevision:snapshot.revision, entityVersions:[], action:{ type:'set_daily_minutes', dailyMinutes:20 + index } } });
    return result.status();
  }));
  console.log('Two-tab response statuses', conflict);
  assert.deepEqual(conflict.sort(), [200,409]);
  assert.equal(await second.getByLabel('Source title').inputValue(), 'Unsent local source title');
  console.log('PASS two-tab CAS conflict; unsent local input preserved');
  mkdirSync('.tmp/s3-postgres-runtime', { recursive: true });
  await page.screenshot({ path: '.tmp/s3-postgres-runtime/completed.png', fullPage: true });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('BROWSER_JOURNEY_PASS');
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  await stopWorker();
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 10_000))]);
  await pool.end();
}
