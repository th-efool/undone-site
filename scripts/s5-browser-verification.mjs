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

const { chromium } = await import(
  pathToFileURL(
    resolve(process.env.S3_PLAYWRIGHT_MODULE ?? '.tmp/s3-postgres-runtime/node_modules/playwright-core/index.mjs')
  ).href
);
const pool = new Pool({ connectionString: database.toString() });

// Create creator user and session token
const creatorId = crypto.randomUUID();
await pool.query(`INSERT INTO users (id,email,"updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP)`, [
  creatorId,
  `${creatorId}@example.test`,
]);
const creatorToken = await encode({
  secret: environment.AUTH_SECRET,
  salt: 'authjs.session-token',
  token: { sub: creatorId, name: 'S5 Creator Learner', email: `${creatorId}@example.test` },
});

// Create uninvited user and session token for access isolation test
const uninvitedId = crypto.randomUUID();
await pool.query(`INSERT INTO users (id,email,"updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP)`, [
  uninvitedId,
  `${uninvitedId}@example.test`,
]);
const uninvitedToken = await encode({
  secret: environment.AUTH_SECRET,
  salt: 'authjs.session-token',
  token: { sub: uninvitedId, name: 'S5 Uninvited Stranger', email: `${uninvitedId}@example.test` },
});

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});

const creatorContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await creatorContext.newPage();
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

async function waitReady(wsId) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const row = (
      await pool.query(
        `SELECT revision,snapshot->'processing'->>'status' AS status FROM interaction_workspaces WHERE id=$1`,
        [wsId]
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

let workspaceId;
let cohortId;

try {
  console.log('--- Starting S5 End-to-End Learner Delivery Browser Verification ---');

  // 1. Initial Intake & Auth Handoff
  console.log('Executing authenticated creator intake handoff...');
  await page.goto('http://localhost:3107/', { timeout: 120_000 });
  await page.getByLabel('What do you want to learn about?').fill('Learn Raft consensus and state machine replication.');
  await page.getByRole('button', { name: 'Add sources', exact: true }).click();
  await page.getByLabel('Paste source text').fill(
    'Raft achieves consensus by electing a distinguished leader, then giving the leader complete responsibility for managing the replicated log. Leaders accept log entries from clients, replicate them to other servers, and tell servers when it is safe to apply log entries to their state machines. Majorities overlap to prevent split-brain.'
  );
  await page.getByRole('button', { name: 'Begin journey', exact: true }).click();
  await page.waitForURL('**/auth?**', { timeout: 60_000 });

  await creatorContext.addCookies([
    {
      name: 'authjs.session-token',
      value: creatorToken,
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
  await waitReady(workspaceId);
  console.log('PASS workspace initialized and reached ready state');

  // 2. Inspect Release Readiness in ReleasePanel
  console.log('Verifying release readiness in ReleasePanel...');
  const releaseSection = page.locator('#builder-release');
  await releaseSection.scrollIntoViewIfNeeded();
  await releaseSection.waitFor({ state: 'visible', timeout: 15_000 });

  // Verify ready badge
  await releaseSection.getByText('Ready for Release').waitFor({ timeout: 10_000 });
  console.log('PASS ReleasePanel shows Ready for Release');

  // 3. Execute Private Release ("Start as Learner (Private)")
  console.log('Executing private release action...');
  const releaseBtn = releaseSection.getByRole('button', { name: 'Release & Start Learning', exact: true });
  await releaseBtn.waitFor({ state: 'visible' });

  const [releaseRes] = await Promise.all([
    page.waitForResponse(
      res => res.url().includes(`/api/cohort-builder/workspaces/${workspaceId}/release`) && res.request().method() === 'POST'
    ),
    releaseBtn.click(),
  ]);

  assert.equal(releaseRes.status(), 200, 'Release endpoint must return 200 OK');
  const releaseData = await releaseRes.json();
  assert.equal(releaseData.success, true);
  assert.equal(releaseData.receipt.mode, 'private_activation');
  cohortId = releaseData.receipt.cohortId;
  assert(cohortId, 'Receipt must contain cohortId');
  assert.equal(releaseData.receipt.destinationUrl, `/play?cohort=${cohortId}`);
  console.log(`PASS private release committed with cohortId=${cohortId}`);

  // Verify database state: interaction_effects, interaction_events, and relational cohort
  const effectRow = (
    await pool.query(
      `SELECT "effectKey", "mode", "cohortId", "state" FROM "interaction_effects" WHERE "workspaceId" = $1`,
      [workspaceId]
    )
  ).rows[0];
  assert.equal(effectRow?.state, 'committed', 'interaction_effects state must be committed');
  assert.equal(effectRow?.mode, 'private_activation');

  const eventRow = (
    await pool.query(
      `SELECT "type", "payload" FROM "interaction_events" WHERE "workspaceId" = $1 AND "type" = 'cohort.released'`,
      [workspaceId]
    )
  ).rows[0];
  assert(eventRow, 'cohort.released event must be recorded');

  const cohortRow = (
    await pool.query(
      `SELECT "id", "visibility", "isPublished", "creatorId" FROM "cohorts" WHERE "id" = $1`,
      [cohortId]
    )
  ).rows[0];
  assert.equal(cohortRow?.visibility, 'PRIVATE');
  assert.equal(cohortRow?.isPublished, true);
  assert.equal(cohortRow?.creatorId, creatorId);
  console.log('PASS database transactional artifacts and relational cohort verified');

  // 4. Verify Learner Delivery on /play?cohort=<id>
  console.log(`Verifying learner delivery on /play?cohort=${cohortId}...`);
  await page.waitForURL(`**/play?cohort=${cohortId}`, { timeout: 30_000 });

  // Wait for feed to load content
  const feedRes = await page.waitForResponse(
    res => res.url().includes('/api/feed') && res.url().includes(`cohort=${cohortId}`),
    { timeout: 30_000 }
  );
  assert.equal(feedRes.status(), 200, `Feed response for released cohort must return 200 OK, got ${feedRes.status()}`);
  const feedJson = await feedRes.json();
  assert(feedJson.items && feedJson.items.length > 0, `Feed must return lessons for released cohort, got ${JSON.stringify(feedJson)}`);
  console.log(`PASS feed returned ${feedJson.items.length} lesson chunk(s) for cohort`);

  // Check that the learning surface or lesson card is visible
  await page.locator('article, [class*="surfaceContainer"], [class*="readingContainer"], [class*="lessonCard"]').first().waitFor({ timeout: 20_000 });
  console.log('PASS learner delivery rendered lesson content on /play');

  // 5. Test Reload Persistence on /play
  console.log('Testing reload persistence on /play...');
  await page.reload();
  await page.waitForURL(`**/play?cohort=${cohortId}`, { timeout: 30_000 });
  await page.waitForResponse(
    res => res.url().includes('/api/feed') && res.url().includes(`cohort=${cohortId}`) && res.status() === 200,
    { timeout: 30_000 }
  );
  await page.locator('article, [class*="surfaceContainer"], [class*="readingContainer"], [class*="lessonCard"]').first().waitFor({ timeout: 20_000 });
  console.log('PASS reload persistence verified on /play');

  // 6. Test Privacy & Visibility Enforcement (Uninvited User)
  console.log('Testing privacy isolation for uninvited user...');
  const strangerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await strangerContext.addCookies([
    {
      name: 'authjs.session-token',
      value: uninvitedToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
  ]);
  const strangerPage = await strangerContext.newPage();
  strangerPage.setDefaultTimeout(30_000);

  // Navigate to /play with private cohort: uninvited user must NOT see lessons
  const strangerFeedPromise = strangerPage.waitForResponse(
    res => res.url().includes('/api/feed') && res.url().includes(`cohort=${cohortId}`)
  );
  await strangerPage.goto(`http://localhost:3107/play?cohort=${cohortId}`);
  const strangerFeedRes = await strangerFeedPromise;
  const strangerFeedJson = await strangerFeedRes.json();
  assert.equal(
    strangerFeedJson.items.length,
    0,
    'Feed must return zero items for unauthorized user attempting to access private cohort'
  );
  await strangerPage.getByText(/No remaining lessons|Loading your lessons/i).first().waitFor({ timeout: 10_000 });
  console.log('PASS private cohort lessons blocked for uninvited user in /play');

  // Navigate to /cohort/:cohortId: uninvited user gets 404 (Not Found)
  const strangerCohortRes = await strangerPage.goto(`http://localhost:3107/cohort/${cohortId}`);
  // Either direct 404 or redirect to /overview with 404
  const finalStatus = strangerCohortRes.status();
  const bodyText = await strangerPage.textContent('body');
  assert(
    finalStatus === 404 || bodyText.includes('404') || bodyText.includes('This page could not be found'),
    `Uninvited user must receive 404 on private cohort, got status ${finalStatus}`
  );
  console.log('PASS uninvited user received 404 on private cohort overview');
  await strangerContext.close();

  // 7. Upgrade Promotion: Promote to "Publish to Directory (Public)"
  console.log('Promoting cohort to Public Publish in builder...');
  await page.goto(`http://localhost:3107/quest/build/${workspaceId}`, { timeout: 60_000 });
  await waitReady(workspaceId);

  const releaseSectionPromote = page.locator('#builder-release');
  await releaseSectionPromote.scrollIntoViewIfNeeded();

  // Select Public Publish radio
  const publicRadio = releaseSectionPromote.locator('input[value="public_publish"]');
  await publicRadio.check({ force: true });

  const publishBtn = releaseSectionPromote.locator('button[class*="releaseBtn"]');
  await publishBtn.waitFor({ state: 'visible' });

  const [promoteRes] = await Promise.all([
    page.waitForResponse(
      res => res.url().includes(`/api/cohort-builder/workspaces/${workspaceId}/release`) && res.request().method() === 'POST'
    ),
    publishBtn.click(),
  ]);

  assert.equal(promoteRes.status(), 200, 'Public promotion must return 200 OK');
  const promoteData = await promoteRes.json();
  assert.equal(promoteData.receipt.mode, 'public_publish');
  console.log('PASS promoted to public_publish');

  // Verify in DB that cohort is now PUBLIC
  const publicCohortRow = (
    await pool.query(`SELECT "visibility" FROM "cohorts" WHERE "id" = $1`, [cohortId])
  ).rows[0];
  assert.equal(publicCohortRow?.visibility, 'PUBLIC', 'Cohort visibility must be updated to PUBLIC in database');
  console.log('PASS cohort visibility updated to PUBLIC in database');

  // 8. Verify Public Delivery for Anonymous / Unauthenticated Learner
  console.log('Verifying public discovery and delivery for anonymous learner...');
  const anonContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const anonPage = await anonContext.newPage();
  anonPage.setDefaultTimeout(30_000);

  const anonOverviewRes = await anonPage.goto(`http://localhost:3107/cohort/${cohortId}/overview`);
  assert.equal(anonOverviewRes.status(), 200, 'Public cohort overview must return 200 OK for anonymous users');

  // Verify cohort title is rendered on public overview page
  await anonPage.locator('h1, h2, [class*="title"]').filter({ hasText: /Draft Curriculum|quorum|Raft/i }).first().waitFor({ timeout: 15_000 });
  // Verify Join button is present
  await anonPage.getByRole('button', { name: /Join Cohort/i }).first().waitFor({ timeout: 10_000 });
  console.log('PASS anonymous visitor successfully accessed public cohort overview and curriculum');
  await anonContext.close();

  // 9. Verify Downgrade Protection
  console.log('Verifying downgrade protection...');
  // A. Check that the UI disables the private activation radio
  await page.goto(`http://localhost:3107/quest/build/${workspaceId}`, { timeout: 60_000 });
  await waitReady(workspaceId);
  const releaseSectionAfter = page.locator('#builder-release');
  await releaseSectionAfter.scrollIntoViewIfNeeded();
  const privateRadioAfter = releaseSectionAfter.locator('input[value="private_activation"]');
  assert.equal(await privateRadioAfter.isDisabled(), true, 'Private activation radio must be disabled after public release');

  // B. Verify direct API request to downgrade returns 409
  const downgradeAttempt = await page.request.post(
    `http://localhost:3107/api/cohort-builder/workspaces/${workspaceId}/release`,
    {
      data: { mode: 'private_activation' },
    }
  );
  assert.equal(downgradeAttempt.status(), 409, 'Downgrade attempt must be rejected with 409 Conflict');
  const downgradeBody = await downgradeAttempt.json();
  assert.equal(downgradeBody.code, 'CANNOT_DOWNGRADE_PUBLIC_COHORT');
  console.log('PASS downgrade protection enforced by both UI and server');

  // 10. Capture Evidence Screenshot
  mkdirSync('.tmp/s5-postgres-runtime', { recursive: true });
  await page.goto(`http://localhost:3107/cohort/${cohortId}/overview`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.tmp/s5-postgres-runtime/s5-completed.png', fullPage: true });
  assert.equal(errors.length, 0, `Unexpected page errors: ${errors.join('\n')}`);

  console.log('S5_BROWSER_DELIVERY_PASS');
} catch (error) {
  console.error('S5 browser verification error:', error);
  mkdirSync('.tmp/s5-postgres-runtime', { recursive: true });
  await page.screenshot({ path: '.tmp/s5-postgres-runtime/s5-failure.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await stopWorker();
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 10_000))]);
  await pool.end();
}
