import { Pool } from 'pg';
import { encode } from 'next-auth/jwt';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, symlinkSync, copyFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
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
const userId = crypto.randomUUID(); let workspaceId;
await pool.query(`INSERT INTO users (id,email,"updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP)`, [userId, `${userId}@example.test`]);
const token = await encode({ secret: environment.AUTH_SECRET, salt: 'authjs.session-token',
  token: { sub: userId, name: 'S3 Test Learner', email: `${userId}@example.test` } });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
let disabledServer;
const waitReady = () => page.locator('section[aria-label="Grounded source text"] small').filter({ hasText:/^ready$/ }).waitFor({ timeout:120_000 });
async function stopWorker() {
  if (worker.exitCode !== null) return;
  const closed = new Promise(resolve => worker.once('close', resolve));
  worker.kill(); await closed;
}
try {
  await page.goto('http://localhost:3107/', { timeout: 120_000 });
  await page.getByLabel('What do you want to learn about?').fill('Help me learn quorum overlap.');
  await page.getByRole('button', { name:'Add sources', exact:true }).click();
  await page.getByLabel('Paste source text').fill('Quorums overlap. Logs retain writes.');
  await page.getByRole('button', { name:'Begin journey', exact:true }).click();
  await page.waitForURL('**/auth?**', { timeout:60_000 });
  assert(!page.url().includes('quorum') && !page.url().includes('Quorums'));
  await context.addCookies([{ name:'authjs.session-token', value:token, domain:'localhost', path:'/', httpOnly:true, sameSite:'Lax', secure:false }]);
  await page.goto('http://localhost:3107/quest/start');
  await page.getByText('Confirm this learning goal for your signed-in account.').waitFor();
  const originalIntake = await page.evaluate(() => JSON.parse(sessionStorage.getItem('undone:cohort-intake')).body);
  // The server commits, but the browser loses the acknowledgement. Retry must navigate to the original workspace.
  await page.route('**/api/cohort-builder/intake', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const saved = await route.fetch(); assert.equal(saved.status(),202);
    workspaceId = (await saved.json()).workspaceId;
    await route.abort('failed'); await page.unroute('**/api/cohort-builder/intake');
  });
  await page.getByRole('button', { name:'Create cohort', exact:true }).click();
  await page.getByRole('alert').filter({ hasText:'Your input is retained' }).waitFor();
  await page.getByRole('button', { name:'Create cohort', exact:true }).click();
  await page.waitForURL(`**/quest/build/${workspaceId}`, { timeout:60_000 });
  const repeated = await context.request.post('http://localhost:3107/api/cohort-builder/intake', {
    headers:{ Origin:'http://localhost:3107' }, data:{ ...originalIntake, expectedOwnerId:userId } });
  assert.equal(repeated.status(),202); assert.equal((await repeated.json()).workspaceId,workspaceId);
  const wrongIdentity = await context.request.post('http://localhost:3107/api/cohort-builder/intake', {
    headers:{ Origin:'http://localhost:3107' }, data:{ ...originalIntake, expectedOwnerId:crypto.randomUUID() } });
  assert.equal(wrongIdentity.status(),409);
  assert.equal(Number((await pool.query(`SELECT count(*) FROM interaction_messages WHERE "workspaceId"=$1 AND role='user'`,[workspaceId])).rows[0].count),1);
  console.log('PASS landing/authentication return, private handoff and committed-response-loss intake retry');
  await page.getByRole('main', { name: 'Cohort Curriculum Workspace' }).waitFor({ timeout: 120_000 });
  await page.getByText('live', { exact: true }).waitFor({ timeout: 30_000 });
  assert(await page.getByRole('button',{ name:'Send message',exact:true }).evaluate(node => node.getBoundingClientRect().bottom <= window.innerHeight), 'Composer must remain within viewport');
  assert(page.url().includes('/quest/build/'));
  await page.waitForFunction(() => document.body.textContent.includes('Pasted text'));
  console.log(`BROWSER_AUTH_AND_INTAKE_PASS workspace=${workspaceId}`);
  await page.getByText('Learning goal saved.', { exact: true }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll('main[aria-label="Cohort Curriculum Workspace"] article').length === 2, undefined, { timeout:120_000 });
  console.log('PASS authenticated chat goal and grounded lesson generation');
  assert((await page.locator('main').innerText()).includes('Quorums overlap.'));
  await page.getByText('Inspect evidence', { exact:true }).first().click();
  await page.locator('details[open] cite').first().waitFor();
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
  await page.setViewportSize({ width:390, height:844 });
  await page.getByLabel('Source title').fill('Mobile source draft');
  await page.getByRole('button', { name:'Chat', exact:true }).click();
  await page.getByLabel('Message the cohort assistant').fill('Mobile unsent chat');
  await page.getByRole('button', { name:'Workspace', exact:true }).click();
  assert.equal(await page.getByLabel('Source title').inputValue(),'Mobile source draft');
  await page.getByRole('button', { name:'Chat', exact:true }).click();
  assert.equal(await page.getByLabel('Message the cohort assistant').inputValue(),'Mobile unsent chat');
  await page.getByLabel('Message the cohort assistant').fill('');
  await page.getByRole('button', { name:'Workspace', exact:true }).click();
  await page.getByLabel('Source title').fill('');
  await page.setViewportSize({ width:1280, height:900 });
  console.log('PASS mobile pane switching retains chat/source drafts without duplicate stores');
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
    const result = await context.request.post(`${endpoint}/actions`, { timeout: 30_000, headers: { Origin:'http://localhost:3107', 'idempotency-key':actionId },
      data: { actionId, workspaceId, expectedRevision:snapshot.revision, entityVersions:[], action:{ type:'set_daily_minutes', dailyMinutes:20 + index } } });
    return result.status();
  }));
  console.log('Two-tab response statuses', conflict);
  assert.deepEqual(conflict.sort(), [200,409]);
  assert.equal(await second.getByLabel('Source title').inputValue(), 'Unsent local source title');
  console.log('PASS two-tab CAS conflict; unsent local input preserved');
  await Promise.all([page.reload(),second.reload()]);
  await page.getByText('live',{ exact:true }).waitFor();
  await second.getByText('live',{ exact:true }).waitFor();
  await waitReady();
  await page.getByRole('button', { name:'Edit lesson', exact:true }).first().click();
  await second.getByRole('button', { name:'Edit lesson', exact:true }).first().click();
  await page.getByRole('dialog').locator('textarea').fill('First tab saved objective');
  await second.getByRole('dialog').locator('textarea').fill('Second tab attempted objective');
  await page.getByRole('button', { name:'Update Lesson', exact:true }).click();
  await page.getByText('First tab saved objective',{ exact:true }).waitFor();
  await second.getByRole('button', { name:'Update Lesson', exact:true }).click();
  await second.getByText('This lesson changed while you were editing. Your writing is retained.').waitFor();
  assert.equal(await second.getByRole('dialog').locator('textarea').inputValue(),'Second tab attempted objective');
  await second.getByRole('button', { name:'Use current version and keep my edit', exact:true }).click();
  await second.getByRole('button', { name:'Update Lesson', exact:true }).click();
  await second.getByText('Second tab attempted objective', { exact:true }).waitFor();
  console.log('PASS actual editor conflict, comparison and explicit reapplication');
  await stopWorker(); worker = startWorker();
  await page.getByLabel('Message the cohort assistant').fill('Queue and stop this assistant turn');
  await page.getByRole('button', { name:'Send message', exact:true }).click();
  await page.getByRole('button', { name:'Stop assistant turn', exact:true }).waitFor();
  await page.getByText(/^Assistant running\./).waitFor();
  // Lose the next message acknowledgement after actual server acceptance.
  await page.route('**/messages', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch(); assert.equal(response.status(),202);
    await route.abort('failed'); await page.unroute('**/messages');
  });
  await page.getByLabel('Message the cohort assistant').fill('Queued follow-up retained exactly once');
  await page.getByRole('button', { name:'Send message', exact:true }).click();
  await page.getByRole('button', { name:'Send message', exact:true }).waitFor({ state:'visible' });
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Send message"]').disabled);
  assert.equal(await page.getByLabel('Message the cohort assistant').inputValue(),'Queued follow-up retained exactly once');
  await page.getByRole('button', { name:'Send message', exact:true }).click();
  const queued = (await pool.query(`SELECT m.id,r.status FROM interaction_messages m LEFT JOIN interaction_runs r ON r."triggeringMessageId"=m.id
    WHERE m."workspaceId"=$1 AND m.parts::text LIKE '%Queued follow-up retained exactly once%'`,[workspaceId])).rows;
  assert.equal(queued.length,1);
  for (let i=0;i<60;i++) {
    const active = await pool.query(`SELECT id FROM interaction_runs WHERE "workspaceId"=$1 AND status IN ('queued','running')`,[workspaceId]);
    if (!active.rows.length) break;
    await new Promise(resolve => setTimeout(resolve,500));
  }
  assert.equal((await pool.query(`SELECT id FROM interaction_runs WHERE "workspaceId"=$1 AND status IN ('queued','running')`,[workspaceId])).rows.length,0);
  console.log('PASS queued messages and lost chat acknowledgement without duplicate turns');
  await waitReady();
  await stopWorker(); worker = startWorker();
  await page.getByLabel('Message the cohort assistant').fill('Stop this separate assistant turn');
  await page.getByRole('button', { name:'Send message', exact:true }).click();
  await page.getByText(/^Assistant running\./).waitFor();
  const [cancellation] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/cancel') && response.request().method()==='POST'),
    page.getByRole('button',{ name:'Stop assistant turn',exact:true }).click(),
  ]);
  assert.equal(cancellation.status(),200);
  await page.waitForFunction(() => document.body.textContent.includes('Stopped or failed turns remain saved'), undefined, { timeout:30_000 });
  assert((await pool.query(`SELECT id FROM interaction_runs WHERE "workspaceId"=$1 AND status='canceled'`,[workspaceId])).rows.length>0);
  console.log('PASS running assistant Stop and visible terminal recovery');
  // A second local-only HTTP process verifies rollout policy without changing the running server or shared configuration.
  const disabledDirectory = mkdtempSync(resolve('.tmp/s4a-disabled-'));
  const checkout = spawnSync('git',['worktree','add','--detach',disabledDirectory,'HEAD'],{ encoding:'utf8', windowsHide:true });
  assert.equal(checkout.status,0,checkout.stderr);
  const changedSource = spawnSync('git',['diff','--name-only','HEAD','--','src'],{ encoding:'utf8', windowsHide:true });
  const newSource = spawnSync('git',['ls-files','--others','--exclude-standard','--','src'],{ encoding:'utf8', windowsHide:true });
  assert.equal(changedSource.status,0); assert.equal(newSource.status,0);
  for (const file of new Set(`${changedSource.stdout}\n${newSource.stdout}`.split(/\r?\n/).filter(Boolean))) {
    const target = resolve(disabledDirectory,file); mkdirSync(dirname(target),{ recursive:true }); copyFileSync(resolve(file),target);
  }
  symlinkSync(resolve('node_modules'),resolve(disabledDirectory,'node_modules'),'junction');
  symlinkSync(resolve('generated'),resolve(disabledDirectory,'generated'),'junction');
  writeFileSync(resolve(disabledDirectory,'.env'), `DATABASE_URL=${database}\nAUTH_SECRET=${environment.AUTH_SECRET}\nINTERACTION_COHORT_V2_ENABLED=0\nINTERACTION_TEXT_DRIVER=durable\nINTERACTION_LOCAL_MODEL_FIXTURE=1\n`);
  disabledServer = spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--webpack','-p','3108'],{ cwd:disabledDirectory, stdio:'ignore', windowsHide:true });
  for (let i=0;i<120;i++) {
    try { if ((await fetch('http://localhost:3108/api/cohort-builder/intake')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve,500));
  }
  const disabled = await context.newPage();
  const denied = await context.request.post('http://localhost:3108/api/cohort-builder/intake',{ headers:{ Origin:'http://localhost:3108' }, data:{ ...originalIntake, requestId:crypto.randomUUID(), expectedOwnerId:userId } });
  assert.equal(denied.status(),403);
  await disabled.goto(`http://localhost:3108/quest/build/${workspaceId}`);
  await disabled.getByText('Second tab attempted objective',{ exact:true }).waitFor();
  const legacy = await disabled.goto('http://localhost:3108/quest/new'); assert.equal(legacy.status(),200);
  assert(!disabled.url().includes('/quest/start'));
  await disabled.goto('http://localhost:3108/');
  await disabled.getByLabel('What do you want to learn about?').fill('Private legacy learning goal');
  await disabled.getByRole('button',{ name:'Begin journey',exact:true }).click();
  await disabled.waitForURL('**/quest/new?handoff=1');
  await disabled.getByText('Private legacy learning goal',{ exact:true }).waitFor();
  assert(!disabled.url().includes('Private'));
  console.log('PASS disabled new intake retains authenticated v2 resume and v1 new route');
  mkdirSync('.tmp/s3-postgres-runtime', { recursive: true });
  await page.screenshot({ path: '.tmp/s3-postgres-runtime/completed.png', fullPage: true });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('BROWSER_JOURNEY_PASS');
} catch (error) { console.error(error); await page.screenshot({ path:'.tmp/s3-postgres-runtime/failure.png', fullPage:true }).catch(() => {}); process.exitCode = 1; }
finally {
  await stopWorker();
  disabledServer?.kill();
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 10_000))]);
  await pool.end();
}
