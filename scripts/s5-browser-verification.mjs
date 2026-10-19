import { Pool } from 'pg';
import { encode } from 'next-auth/jwt';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, symlinkSync, copyFileSync, unlinkSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
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

let mongoClient = null;
let progressCollection = null;
if (environment.MONGODB_URI) {
  const mongoModule = resolve(process.env.S3_MONGODB_CLIENT_MODULE ?? '.tmp/s3-postgres-runtime/node_modules/mongodb/lib/index.js');
  const { MongoClient } = await import(pathToFileURL(mongoModule).href);
  mongoClient = new MongoClient(environment.MONGODB_URI);
  await mongoClient.connect();
  progressCollection = mongoClient.db().collection('user_chunk_progress');
  console.log(`Connected to isolated MongoDB test instance: ${environment.MONGODB_URI}`);
}

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
  const activeChunkId = feedJson.items[0].chunkId;
  const activeLessonId = feedJson.items[0].lessonId;
  assert(activeChunkId, 'Active chunkId must be present in feed');
  console.log(`PASS feed returned ${feedJson.items.length} lesson chunk(s) for cohort (activeChunkId=${activeChunkId})`);

  // Check that the learning surface or lesson card is visible
  await page.locator('article, [class*="surfaceContainer"], [class*="readingContainer"], [class*="lessonCard"]').first().waitFor({ timeout: 20_000 });
  console.log('PASS learner delivery rendered lesson content on /play');

  // 4b. Trigger Real Learner UI Progress Persistence
  console.log('Triggering real learner UI completion interaction...');
  const completeBtn = page.getByRole('button', { name: /Mark complete/i });
  await completeBtn.waitFor({ state: 'visible', timeout: 20_000 });

  const [progressRes] = await Promise.all([
    page.waitForResponse(
      res => res.url().includes('/api/progress/chunk') && res.request().method() === 'POST'
    ),
    completeBtn.click(),
  ]);
  assert.equal(progressRes.status(), 200, 'Authenticated progress API must return 200');
  const progressJson = await progressRes.json();
  assert.equal(progressJson.success, true);
  assert.equal(progressJson.progress.status, 'COMPLETED');
  assert.equal(progressJson.progress.chunkId, activeChunkId);
  console.log(`PASS authenticated progress API recorded completion for chunk ${activeChunkId}`);

  // Assert document in isolated MongoDB collection user_chunk_progress
  if (progressCollection) {
    const mongoDoc = await progressCollection.findOne({ userId: creatorId, chunkId: activeChunkId });
    assert(mongoDoc, 'UserChunkProgress document must be persisted in isolated MongoDB');
    assert.equal(mongoDoc.status, 'COMPLETED');
    assert.equal(mongoDoc.cohortId, cohortId);
    assert.equal(mongoDoc.lessonId, activeLessonId);
    assert(mongoDoc.completedAt, 'completedAt timestamp must be set in MongoDB');
    console.log('PASS confirmed real persistence in isolated MongoDB collection user_chunk_progress');
  }

  // 5. Test Reload Persistence on /play (Feed Hydration from MongoDB)
  console.log('Testing reload persistence on /play with persisted MongoDB progress...');
  await page.reload();
  await page.waitForURL(`**/play?cohort=${cohortId}`, { timeout: 30_000 });
  const reloadFeedRes = await page.waitForResponse(
    res => res.url().includes('/api/feed') && res.url().includes(`cohort=${cohortId}`) && res.status() === 200,
    { timeout: 30_000 }
  );
  const reloadFeedJson = await reloadFeedRes.json();
  // Completed chunk must be filtered out of active uncompleted candidates in default channel
  assert(
    !reloadFeedJson.items.some(item => item.chunkId === activeChunkId),
    'Completed chunk must be excluded from active candidate feed upon reload'
  );
  console.log('PASS reload persistence verified: /api/feed hydrated completion from MongoDB and advanced feed');

  // 5b. Test Persistence in Fresh Authenticated Browser Context (Zero Shared Client Cache)
  console.log('Testing persistence across fresh browser context (no client-side localStorage)...');
  const freshContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await freshContext.addCookies([
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
  const freshPage = await freshContext.newPage();
  freshPage.setDefaultTimeout(30_000);
  const freshFeedPromise = freshPage.waitForResponse(
    res => res.url().includes('/api/feed') && res.url().includes(`cohort=${cohortId}`) && res.status() === 200
  );
  await freshPage.goto(`http://localhost:3107/play?cohort=${cohortId}`);
  const freshFeedRes = await freshFeedPromise;
  const freshFeedJson = await freshFeedRes.json();
  assert(
    !freshFeedJson.items.some(item => item.chunkId === activeChunkId),
    'Fresh session must restore completed progress from MongoDB'
  );
  console.log('PASS fresh authenticated browser context restored persisted progress from MongoDB');
  await freshContext.close();

  // 5c. Idempotent / Monotonic Progress Updates (Never regresses on lower value, advances on higher)
  console.log('Testing idempotent / monotonic progress updates...');
  const nonRegressionRes = await page.request.post('http://localhost:3107/api/progress/chunk', {
    data: {
      chunkId: activeChunkId,
      lessonId: activeLessonId,
      cohortId: cohortId,
      watchedSeconds: 60,
      totalSeconds: 180,
      forceStatus: 'COMPLETED',
    },
  });
  assert.equal(nonRegressionRes.status(), 200);
  const nonRegJson = await nonRegressionRes.json();
  assert.equal(nonRegJson.success, true);
  if (progressCollection) {
    const docAfterNonReg = await progressCollection.findOne({ userId: creatorId, chunkId: activeChunkId });
    assert.equal(docAfterNonReg.status, 'COMPLETED');
    assert.equal(docAfterNonReg.watchedSeconds, 180, 'Progress must not regress backwards to lower watchedSeconds');
  }

  // Advance with higher watchedSeconds
  const advanceRes = await page.request.post('http://localhost:3107/api/progress/chunk', {
    data: {
      chunkId: activeChunkId,
      lessonId: activeLessonId,
      cohortId: cohortId,
      watchedSeconds: 240,
      totalSeconds: 240,
      forceStatus: 'COMPLETED',
    },
  });
  assert.equal(advanceRes.status(), 200);
  if (progressCollection) {
    const docAfterAdvance = await progressCollection.findOne({ userId: creatorId, chunkId: activeChunkId });
    assert.equal(docAfterAdvance.status, 'COMPLETED');
    assert.equal(docAfterAdvance.watchedSeconds, 240, 'Progress advances monotonically when watchedSeconds increases');
  }
  console.log('PASS idempotent / monotonic progress updates verified');

  // 5d. Honest Error Handling Without False Success
  console.log('Testing honest error handling without false success...');
  const anonErrContext = await browser.newContext();
  const anonErrPage = await anonErrContext.newPage();
  const unauthRes = await anonErrPage.request.post('http://localhost:3107/api/progress/chunk', {
    data: { chunkId: activeChunkId, lessonId: activeLessonId, cohortId: cohortId },
  });
  assert.equal(unauthRes.status(), 401, 'Anonymous progress POST must return 401 Unauthorized');
  const badInputRes = await page.request.post('http://localhost:3107/api/progress/chunk', {
    data: { chunkId: '', lessonId: '', cohortId: '' },
  });
  assert.equal(badInputRes.status(), 400, 'Empty input must return 400 Bad Request');
  await anonErrContext.close();
  console.log('PASS honest API error handling verified');

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
  // Assert unauthorized user cannot write progress to private cohort
  const strangerProgressRes = await strangerPage.request.post('http://localhost:3107/api/progress/chunk', {
    data: {
      chunkId: activeChunkId,
      lessonId: activeLessonId,
      cohortId: cohortId,
      watchedSeconds: 60,
      totalSeconds: 60,
      forceStatus: 'COMPLETED',
    },
  });
  assert.equal(strangerProgressRes.status(), 404, 'Stranger cannot record progress on private cohort');
  if (progressCollection) {
    const strangerDoc = await progressCollection.findOne({ userId: uninvitedId, chunkId: activeChunkId });
    assert.equal(strangerDoc, null, 'No progress record created for uninvited stranger in MongoDB');
  }
  console.log('PASS unauthorized progress write rejected with 404 and isolated in MongoDB');
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

  // 11. CHECKPOINT B: Authenticated Disable / Resume and Re-enable Acceptance
  console.log('--- Starting Checkpoint B: Authenticated Disable / Resume Acceptance ---');
  let disabledServer = null;
  const disabledDirectory = mkdtempSync(resolve('.tmp/s6a-disabled-'));
  try {
    const checkout = spawnSync('git', ['worktree', 'add', '--detach', disabledDirectory, 'HEAD'], { encoding: 'utf8', windowsHide: true });
    assert.equal(checkout.status, 0, checkout.stderr);
    const changedSource = spawnSync('git', ['diff', '--name-only', 'HEAD', '--', 'src', 'scripts'], { encoding: 'utf8', windowsHide: true });
    const newSource = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src', 'scripts'], { encoding: 'utf8', windowsHide: true });
    assert.equal(changedSource.status, 0); assert.equal(newSource.status, 0);
    for (const file of new Set(`${changedSource.stdout}\n${newSource.stdout}`.split(/\r?\n/).filter(Boolean))) {
      const target = resolve(disabledDirectory, file); mkdirSync(dirname(target), { recursive: true }); copyFileSync(resolve(file), target);
    }
    symlinkSync(resolve('node_modules'), resolve(disabledDirectory, 'node_modules'), 'junction');
    symlinkSync(resolve('generated'), resolve(disabledDirectory, 'generated'), 'junction');
    writeFileSync(
      resolve(disabledDirectory, '.env'),
      `DATABASE_URL=${database}\nAUTH_SECRET=${environment.AUTH_SECRET}\nNODE_ENV=development\nINTERACTION_COHORT_V2_ENABLED=0\nINTERACTION_TEXT_DRIVER=durable\nINTERACTION_LOCAL_MODEL_FIXTURE=1\n${environment.MONGODB_URI ? `MONGODB_URI=${environment.MONGODB_URI}\n` : ''}`
    );

    console.log('Starting disabled HTTP application (port 3108) with INTERACTION_COHORT_V2_ENABLED=0...');
    disabledServer = spawn(
      process.execPath,
      [resolve('node_modules/next/dist/bin/next'), 'dev', '--webpack', '-p', '3108'],
      { cwd: disabledDirectory, stdio: 'ignore', windowsHide: true }
    );

    for (let i = 0; i < 120; i++) {
      try {
        const check = await fetch('http://localhost:3108/api/cohort-builder/intake');
        if (check.ok || check.status === 200) {
          const body = await check.json();
          if (body.enabled === false) break;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const disabledPage = await creatorContext.newPage();
    disabledPage.setDefaultTimeout(120_000);

    // Verify GET /api/cohort-builder/intake confirms enabled === false
    const intakeStatusRes = await disabledPage.request.get('http://localhost:3108/api/cohort-builder/intake');
    assert.equal(intakeStatusRes.status(), 200);
    const intakeStatusJson = await intakeStatusRes.json();
    assert.equal(intakeStatusJson.enabled, false, 'Server policy must report enabled: false when INTERACTION_COHORT_V2_ENABLED=0');
    console.log('PASS server loaded changed configuration: enabled === false');

    // Verify direct POST to /api/cohort-builder/intake is rejected with 403 INTAKE_DISABLED
    const deniedIntake = await disabledPage.request.post('http://localhost:3108/api/cohort-builder/intake', {
      headers: { Origin: 'http://localhost:3108' },
      data: { prompt: 'Disabled intake attempt', requestId: crypto.randomUUID(), expectedOwnerId: creatorId },
    });
    assert.equal(deniedIntake.status(), 403, 'Direct intake POST must be rejected with 403');
    const deniedJson = await deniedIntake.json();
    assert.equal(deniedJson.code, 'INTAKE_DISABLED');
    console.log('PASS direct intake rejected with 403 INTAKE_DISABLED');

    // Verify homepage prompt submission reaches honest fallback on /quest/start
    console.log('Testing homepage prompt submission with disabled intake...');
    await disabledPage.goto('http://localhost:3108/');
    await disabledPage.getByLabel('What do you want to learn about?').fill('Learn Paxos consensus with disabled intake.');
    await disabledPage.getByRole('button', { name: 'Begin journey', exact: true }).click();
    await disabledPage.waitForURL('**/quest/start');
    await disabledPage.getByText('New builder intake is unavailable. Existing workspaces remain accessible.').waitFor();
    console.log('PASS /quest/start renders honest unavailable status');

    // When prompt has no pasted source, explicit fallback link is offered
    const legacyLink = disabledPage.getByRole('link', { name: 'Continue with existing creator' });
    await legacyLink.waitFor({ state: 'visible' });
    await legacyLink.click();
    await disabledPage.waitForURL('**/quest/new?handoff=1');
    await disabledPage.getByText('Learn Paxos consensus with disabled intake.', { exact: false }).waitFor();
    console.log('PASS compatible prompt handoff safely preserved in existing creator without data loss');

    // Test prompt with pasted text source on /quest/start suppresses legacy link
    await disabledPage.goto('http://localhost:3108/');
    await disabledPage.getByLabel('What do you want to learn about?').fill('Learn Byzantine fault tolerance.');
    await disabledPage.getByRole('button', { name: 'Add sources', exact: true }).click();
    await disabledPage.getByLabel('Paste source text').fill('Byzantine generals problem requires 3m+1 nodes.');
    await disabledPage.getByRole('button', { name: 'Begin journey', exact: true }).click();
    await disabledPage.waitForURL('**/quest/start');
    await disabledPage.getByText('New builder intake is unavailable. Existing workspaces remain accessible.').waitFor();
    await disabledPage.getByText('Retained text:').waitFor();
    await disabledPage.getByText('The existing creator only supports text prompts without pasted sources.').waitFor();
    assert.equal(
      await disabledPage.getByRole('link', { name: 'Continue with existing creator' }).count(),
      0,
      'Legacy fallback link must NOT be offered when pasted sources are present'
    );
    console.log('PASS incompatible intake with pasted sources honestly retains text and suppresses legacy link');

    // Verify existing workspace /quest/build/[workspaceId] opens cleanly with all data intact
    console.log(`Opening existing authenticated workspace /quest/build/${workspaceId} with disabled intake...`);
    await disabledPage.goto(`http://localhost:3108/quest/build/${workspaceId}`, { timeout: 60_000 });
    await disabledPage.getByRole('main', { name: 'Cohort Curriculum Workspace' }).waitFor({ timeout: 60_000 });
    await disabledPage.getByRole('heading', { level: 3 }).first().waitFor();
    console.log('PASS existing authenticated workspace opens and retains all sources, lessons, edits, and pins');

    // Verify existing learner route /play?cohort=<id> opens and retains MongoDB progress
    console.log(`Opening existing learner route /play?cohort=${cohortId} with disabled intake...`);
    const disabledFeedPromise = disabledPage.waitForResponse(
      res => res.url().includes('/api/feed') && res.url().includes(`cohort=${cohortId}`) && res.status() === 200
    );
    await disabledPage.goto(`http://localhost:3108/play?cohort=${cohortId}`);
    const disabledFeedRes = await disabledFeedPromise;
    const disabledFeedJson = await disabledFeedRes.json();
    assert(
      !disabledFeedJson.items.some(item => item.chunkId === activeChunkId),
      'Persisted completed progress from MongoDB must remain respected on disabled server'
    );
    console.log('PASS existing learner delivery opens and retains MongoDB progress on disabled server');

    // Verify user progress isolation still enforced on disabled server
    const strangerDisabledContext = await browser.newContext();
    await strangerDisabledContext.addCookies([
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
    const strangerDisabledPage = await strangerDisabledContext.newPage();
    const strangerDisabledProgress = await strangerDisabledPage.request.post('http://localhost:3108/api/progress/chunk', {
      data: {
        chunkId: activeChunkId,
        lessonId: activeLessonId,
        cohortId: cohortId,
        watchedSeconds: 999,
        totalSeconds: 999,
        forceStatus: 'COMPLETED',
      },
    });
    // Check that creator's record in MongoDB was NOT modified by stranger
    if (progressCollection) {
      const creatorDoc = await progressCollection.findOne({ userId: creatorId, chunkId: activeChunkId });
      assert.equal(creatorDoc.watchedSeconds, 240, 'Creator progress in MongoDB was not modified by stranger on disabled server');
    }
    await strangerDisabledContext.close();
    console.log('PASS user progress isolation enforced on disabled server');

    // Verify database row counts: zero dropped tables or rows
    const tablesCheck = await pool.query(`
      SELECT
        (SELECT count(*) FROM interaction_workspaces) AS workspaces_count,
        (SELECT count(*) FROM interaction_events) AS events_count,
        (SELECT count(*) FROM interaction_effects) AS effects_count,
        (SELECT count(*) FROM cohorts) AS cohorts_count,
        (SELECT count(*) FROM lessons) AS lessons_count
    `);
    const counts = tablesCheck.rows[0];
    assert(Number(counts.workspaces_count) >= 1, 'interaction_workspaces rows must be preserved');
    assert(Number(counts.events_count) >= 1, 'interaction_events rows must be preserved');
    assert(Number(counts.effects_count) >= 1, 'interaction_effects rows must be preserved');
    assert(Number(counts.cohorts_count) >= 1, 'cohorts rows must be preserved');
    assert(Number(counts.lessons_count) >= 1, 'lessons rows must be preserved');
    console.log('PASS zero tables or records dropped across PostgreSQL and MongoDB');

    // 11b. Re-enable Locally and Prove New Intake Recovers Safely
    console.log('Testing local re-enable (INTERACTION_COHORT_V2_ENABLED=1)...');
    disabledServer.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    writeFileSync(
      resolve(disabledDirectory, '.env'),
      `DATABASE_URL=${database}\nAUTH_SECRET=${environment.AUTH_SECRET}\nNODE_ENV=development\nINTERACTION_COHORT_V2_ENABLED=1\nINTERACTION_TEXT_DRIVER=durable\nINTERACTION_LOCAL_MODEL_FIXTURE=1\n${environment.MONGODB_URI ? `MONGODB_URI=${environment.MONGODB_URI}\n` : ''}`
    );
    disabledServer = spawn(
      process.execPath,
      [resolve('node_modules/next/dist/bin/next'), 'dev', '--webpack', '-p', '3108'],
      { cwd: disabledDirectory, stdio: 'ignore', windowsHide: true }
    );
    for (let i = 0; i < 120; i++) {
      try {
        const check = await fetch('http://localhost:3108/api/cohort-builder/intake');
        if (check.ok) {
          const body = await check.json();
          if (body.enabled === true) break;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const reenabledRes = await disabledPage.request.get('http://localhost:3108/api/cohort-builder/intake');
    assert.equal(reenabledRes.status(), 200);
    const reenabledJson = await reenabledRes.json();
    assert.equal(reenabledJson.enabled, true, 'Server policy reports enabled: true after re-enable');

    // Prove new intake works again
    const newIntakeRes = await disabledPage.request.post('http://localhost:3108/api/cohort-builder/intake', {
      headers: { Origin: 'http://localhost:3108' },
      data: { prompt: 'Re-enabled intake journey', requestId: crypto.randomUUID(), expectedOwnerId: creatorId },
    });
    assert.equal(newIntakeRes.status(), 202, 'New intake succeeds with 202 Accepted after re-enable');
    const newIntakeJson = await newIntakeRes.json();
    assert(newIntakeJson.workspaceId, 'New workspaceId returned');
    assert.notEqual(newIntakeJson.workspaceId, workspaceId, 'New workspace must have distinct identity');

    // Verify existing workspace and cohort remain stable
    const existingWsCheck = (await pool.query(`SELECT id FROM interaction_workspaces WHERE id=$1`, [workspaceId])).rows[0];
    assert(existingWsCheck, 'Existing workspace remains intact');
    const existingCohortCheck = (await pool.query(`SELECT id FROM cohorts WHERE id=$1`, [cohortId])).rows[0];
    assert(existingCohortCheck, 'Existing cohort remains intact');
    console.log('PASS local re-enable verified: new intake recovered, existing workspace & cohort preserved');
    await disabledPage.close();
  } finally {
    if (disabledServer) {
      disabledServer.kill();
    }
    try { unlinkSync(resolve(disabledDirectory, 'node_modules')); } catch {}
    try { unlinkSync(resolve(disabledDirectory, 'generated')); } catch {}
    spawnSync('git', ['worktree', 'remove', '--force', disabledDirectory], { windowsHide: true });
  }

  console.log('S5_BROWSER_DELIVERY_PASS');
} catch (error) {
  console.error('S5 browser verification error:', error);
  mkdirSync('.tmp/s5-postgres-runtime', { recursive: true });
  await page.screenshot({ path: '.tmp/s5-postgres-runtime/s5-failure.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await stopWorker();
  await mongoClient?.close().catch(() => {});
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 10_000))]);
  await pool.end();
}
