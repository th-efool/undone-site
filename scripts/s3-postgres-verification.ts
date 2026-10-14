/** Opt-in isolated PostgreSQL verification. Refuses non-loopback/non-test databases. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { cohortWorkspaceSchema, planCohortAction } from '../src/shared/cohort-builder/contracts';
import { claimTextJob } from '../src/server/domain/cohort-builder/text-jobs';
import { putTextArtifact } from '../src/server/domain/cohort-builder/text-artifacts';
import { acceptCurrentTextJob } from '../src/server/domain/cohort-builder/text-job-acceptance';
import { runDurableTextJobTick } from '../src/server/domain/cohort-builder/durable-text-worker';
import type { TextJobTransactionPort } from '../src/server/domain/cohort-builder/text-job-scheduler';
import { createServer } from 'node:http';
import { LiveYoutubeTranscriptProvider } from '../src/server/domain/cohort-builder/youtube-transcript-live';

async function main() {
const url = new URL(process.env.S3_TEST_DATABASE_URL ?? '');
assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.startsWith('/s3test'), 'Isolated loopback s3test database required');
process.env.DATABASE_URL = url.toString();
process.env.INTERACTION_TEXT_DRIVER = 'durable';
(process.env as Record<string, string | undefined>).NODE_ENV = process.env.NODE_ENV || 'test';
const { prisma } = await import('../src/server/infrastructure/db/postgres/client');
const { createPostgresInteractionRepository } = await import('../src/server/infrastructure/db/postgres/repositories/interaction.repo');
const repo = createPostgresInteractionRepository(prisma);
const pool = new Pool({ connectionString: url.toString(), max: 5, options: '-c timezone=UTC' });
const sql = { query: (s: string, p: unknown[]) => pool.query(s, p) };
const port: TextJobTransactionPort = { transaction: async work => {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work({ query: (s, p) => client.query(s, p) }); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
} };
const ownerId = crypto.randomUUID();
const workspaceId = crypto.randomUUID();
const snapshot = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'PostgreSQL verification', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 20, lessons: [] });
let now = new Date();
try {
  await prisma.user.create({ data: { id: ownerId, email: `${ownerId}@example.test` } });
  await repo.createWorkspace({ id: workspaceId, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: snapshot });
  const envelope = { actionId: crypto.randomUUID(), workspaceId, expectedRevision: 0, entityVersions: [],
    action: { type: 'add_text_source', sourceId: 'a', label: 'Notes', text: 'Quorums overlap.' } };
  const command = { ownerId, workspaceId, expectedRevision: 0, requestId: 'same-request', envelope, plan: planCohortAction };
  const receipts = await Promise.all([repo.commitAction(command), repo.commitAction(command)]);
  assert.deepEqual(receipts[0], receipts[1]);
  console.log('PASS concurrent canonical action idempotency');
  now = new Date(Date.now() + 2_000);
  const claims = await Promise.all([claimTextJob(sql, 'one', now, 1_000), claimTextJob(sql, 'two', now, 1_000)]);
  assert.equal(claims.filter(Boolean).length, 1);
  const old = claims.find(Boolean)!;
  console.log('PASS simultaneous claims: one owner');
  now = new Date(now.getTime() + 1_001);
  const replacement = (await claimTextJob(sql, 'replacement', now, 60_000))!;
  assert.equal(replacement.id, old.id);
  const artifact = await putTextArtifact(sql, { workspaceId, sourceId: 'a', sourceVersion: 0, kind: 'source_raw',
    inputFingerprint: old.dependencyFingerprint, bytes: Buffer.from('Quorums overlap.') });
  assert.equal(await acceptCurrentTextJob(port, old, artifact, now), false);
  console.log('PASS expired lease replacement and stale result rejection');
  const current = (await repo.loadWorkspace({ ownerId, workspaceId }))!;
  await repo.commitAction({ ownerId, workspaceId, expectedRevision: current.revision, requestId: 'source-edit', plan: planCohortAction,
    envelope: { ...envelope, actionId: crypto.randomUUID(), expectedRevision: current.revision,
      action: { type: 'edit_text_source', sourceId: 'a', label: 'Changed', text: 'Quorums intersect.' } } });
  assert.equal(await acceptCurrentTextJob(port, replacement, artifact, now), false);
  console.log('PASS canonical source edit fences claimed old result');
  const racingJob = (await claimTextJob(sql, 'racing-worker', now, 60_000))!;
  const racingArtifact = await putTextArtifact(sql, { workspaceId, sourceId: 'a', sourceVersion: 1, kind: 'source_raw',
    inputFingerprint: racingJob.dependencyFingerprint, bytes: Buffer.from('Quorums intersect.') });
  const racedWorkspace = (await repo.loadWorkspace({ ownerId, workspaceId }))!;
  const racingEdit = (revision: number) => repo.commitAction({ ownerId, workspaceId, expectedRevision: revision,
    requestId: `race-edit:${revision}`, plan: planCohortAction, envelope: { ...envelope, actionId: crypto.randomUUID(), expectedRevision: revision,
      action: { type: 'edit_text_source', sourceId: 'a', label: 'Concurrent revision', text: 'Quorums share members.' } } });
  const race = await Promise.allSettled([acceptCurrentTextJob(port, racingJob, racingArtifact, now), racingEdit(racedWorkspace.revision)]);
  if (race[1].status === 'rejected') {
    assert.equal(race[1].reason.message, 'STALE_WORKSPACE');
    await racingEdit((await repo.loadWorkspace({ ownerId, workspaceId }))!.revision);
  }
  const raced = cohortWorkspaceSchema.parse((await repo.loadWorkspace({ ownerId, workspaceId }))!.snapshot);
  assert.equal(raced.sources[0].version, 2);
  assert.equal(raced.chunks.length, 0);
  console.log('PASS simultaneous source edit versus acceptance serializes without stale evidence');
  // An event error must undo accepted job and snapshot changes on the same SQL connection.
  const triggerName = `s3_reject_${workspaceId.replaceAll('-', '')}`;
  await pool.query(`CREATE FUNCTION "${triggerName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW."workspaceId" = '${workspaceId}' THEN RAISE EXCEPTION 'TEST_EVENT_FAILURE'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON interaction_events FOR EACH ROW EXECUTE FUNCTION "${triggerName}"()`);
  const before = (await repo.loadWorkspace({ ownerId, workspaceId }))!;
  const failed = await runDurableTextJobTick({ sql, transaction: port, workerId: 'event-failure', leaseMs: 60_000,
    now: () => now, loadWorkspace: async () => (await repo.loadWorkspace({ ownerId, workspaceId }))!.snapshot }).then(() => null, error => error);
  assert(failed, 'Event failure must surface');
  assert.equal((await repo.loadWorkspace({ ownerId, workspaceId }))!.revision, before.revision);
  const accepted = await pool.query(`SELECT id FROM cohort_text_jobs WHERE "workspaceId"=$1 AND "sourceVersion"=2 AND status='accepted'`, [workspaceId]);
  assert.equal(accepted.rows.length, 0);
  await pool.query(`DROP TRIGGER "${triggerName}" ON interaction_events`);
  await pool.query(`DROP FUNCTION "${triggerName}"()`);
  console.log('PASS event failure rolls back job acceptance and projection');
  // Replace the failed worker after its claim expires; complete all stages using the real repository.
  now = new Date(now.getTime() + 60_001);
  for (let i = 0; i < 5; i++) {
    const result = await runDurableTextJobTick({ sql, transaction: port, workerId: 'resumed', leaseMs: 60_000,
      now: () => now, loadWorkspace: async () => (await repo.loadWorkspace({ ownerId, workspaceId }))!.snapshot });
    assert.equal(result.status, 'accepted');
  }
  const final = (await repo.loadWorkspace({ ownerId, workspaceId }))!;
  const view = cohortWorkspaceSchema.parse(final.snapshot);
  assert.equal(view.processing.status, 'ready'); assert.equal(view.lessons.length, 1);
  const events = await repo.queryEvents({ ownerId, workspaceId, afterSequence: 0, limit: 100 });
  assert.equal(events.length, final.sequence);
  assert.deepEqual(events.map(event => event.sequence), Array.from({ length: final.sequence }, (_, i) => i + 1));
  console.log('PASS real PostgreSQL restart, grounded completion and contiguous event sequence');
  const { acceptCohortIntake } = await import('../src/server/infrastructure/db/postgres/cohort-intake');
  const intake = { requestId: crypto.randomUUID(), prompt: 'Learn consensus', source: { label: 'Notes', text: '  Quorums overlap.\n' } };
  const intakeReceipts = await Promise.all([acceptCohortIntake(ownerId, intake), acceptCohortIntake(ownerId, intake)]);
  assert.deepEqual(intakeReceipts[0], intakeReceipts[1]);
  const intakeId = intakeReceipts[0].workspaceId;
  assert.equal(await prisma.interactionMessage.count({ where: { workspaceId: intakeId } }), 1);
  assert.equal(await prisma.interactionRun.count({ where: { workspaceId: intakeId } }), 1);
  assert.equal(await prisma.cohortTextJob.count({ where: { workspaceId: intakeId } }), 5);
  const intakeState = cohortWorkspaceSchema.parse((await repo.loadWorkspace({ workspaceId: intakeId, ownerId }))!.snapshot);
  assert.equal(intakeState.sources[0].text, intake.source.text);
  await assert.rejects(acceptCohortIntake(ownerId, { ...intake, prompt: 'Different' }), /IDEMPOTENCY_MISMATCH/);
  const other = await acceptCohortIntake(ownerId, { requestId: crypto.randomUUID(), prompt: 'No source yet' });
  assert.notEqual(other.workspaceId, intakeId);
  // A failing persisted event rolls back workspace, source jobs and scheduling together.
  await pool.query(`CREATE FUNCTION s4a_reject_intake() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF (SELECT snapshot->>'intent' FROM interaction_workspaces WHERE id=NEW."workspaceId") = 'Rollback intake'
    THEN RAISE EXCEPTION 'TEST_INTAKE_ROLLBACK'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER s4a_reject_intake BEFORE INSERT ON interaction_events FOR EACH ROW EXECUTE FUNCTION s4a_reject_intake()`);
  try {
    await assert.rejects(acceptCohortIntake(ownerId, { ...intake, requestId: crypto.randomUUID(), prompt: 'Rollback intake' }));
    assert.equal(await prisma.interactionWorkspace.count({ where: { ownerId, snapshot: { path: ['intent'], equals: 'Rollback intake' } } }), 0);
  } finally { await pool.query('DROP TRIGGER s4a_reject_intake ON interaction_events'); await pool.query('DROP FUNCTION s4a_reject_intake()'); }
  console.log('PASS atomic landing intake, concurrent/lost-response retry, mismatch and event rollback');
  const queueId = other.workspaceId;
  const firstRun = (await repo.claimRun({ workspaceId: queueId, leaseOwner: 'queue-one', leaseToken: 'first', leaseDurationMs: 60_000 }))!;
  assert(firstRun);
  const queuedIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = crypto.randomUUID(); queuedIds.push(id);
    await repo.appendMessage({ workspaceId: queueId, ownerId, id, role: 'user', parts: [{ type: 'text', text: `Queued ${i}` }], requestId: id });
  }
  await assert.rejects(repo.appendMessage({ workspaceId: queueId, ownerId, id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: 'Overflow' }] }), /MESSAGE_QUEUE_FULL/);
  assert(await repo.completeRun({ runId: firstRun.id, leaseToken: 'first' }));
  const next = (await repo.claimRun({ workspaceId: queueId, leaseOwner: 'queue-two', leaseToken: 'second', leaseDurationMs: 60_000 }))!;
  assert.equal(next.triggeringMessageId, queuedIds[0]);
  assert(await repo.cancelRun({ runId: next.id, workspaceId: queueId, ownerId }));
  const afterCancel = await prisma.interactionEvent.count({ where: { workspaceId: queueId } });
  assert(await repo.cancelRun({ runId: next.id, workspaceId: queueId, ownerId }));
  assert.equal(await prisma.interactionEvent.count({ where: { workspaceId: queueId } }),afterCancel);
  const { bindAssistantLease } = await import('../src/server/infrastructure/db/postgres/assistant-queue');
  await assert.rejects(bindAssistantLease(repo, next.id, 'second').appendMessage({ workspaceId: queueId, ownerId, id: crypto.randomUUID(), role: 'assistant', parts: [{ type: 'text', text: 'Late success' }] }), /RUN_CANCELED/);
  const third = (await repo.claimRun({ workspaceId: queueId, leaseOwner: 'queue-three', leaseToken: 'third', leaseDurationMs: 60_000 }))!;
  assert.equal(third.triggeringMessageId, queuedIds[1]);
  await prisma.interactionRun.update({ where: { id: third.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
  const reclaimed = (await repo.claimRun({ workspaceId: queueId, leaseOwner: 'replacement', leaseToken: 'replacement', leaseDurationMs: 60_000 }))!;
  assert.equal(reclaimed.id, third.id);
  await assert.rejects(bindAssistantLease(repo, third.id, 'third').appendMessage({ workspaceId: queueId, ownerId, id: crypto.randomUUID(), role: 'assistant', parts: [{ type: 'text', text: 'Old worker' }] }), /FENCE_EXPIRED/);
  assert(await repo.failRun({ runId: third.id, leaseToken: 'replacement', error: 'TEST_PROVIDER_FAILURE' }));
  for (const expected of queuedIds.slice(2)) {
    const run = (await repo.claimRun({ workspaceId: queueId, leaseOwner: 'drain', leaseToken: expected, leaseDurationMs: 60_000 }))!;
    assert.equal(run.triggeringMessageId, expected);
    assert(await repo.completeRun({ runId: run.id, leaseToken: expected }));
  }
  assert.equal(await repo.claimRun({ workspaceId: queueId, leaseOwner: 'empty', leaseToken: 'empty', leaseDurationMs: 60_000 }), null);
  console.log('PASS persisted FIFO admission, bounded queue, cancellation/replacement transcript fences and terminal recovery');
  await pool.query(readFileSync('prisma/interaction-s4b-sources.sql','utf8'));
  process.env.INTERACTION_PDF_ENABLED='1'; process.env.INTERACTION_WEB_ENABLED='1';
  const { acceptPdfUpload } = await import('../src/server/infrastructure/db/postgres/cohort-pdf-upload');
  const uploadWorkspace = crypto.randomUUID();
  await repo.createWorkspace({ id:uploadWorkspace, ownerId, domainId:'cohort', domainVersion:1, initialSnapshot:snapshot });
  const uploadInput = { workspaceId:uploadWorkspace, requestId:crypto.randomUUID(), expectedRevision:0, label:'Retained PDF' };
  const pdf = Buffer.from('%PDF-1.7\nretained parser input');
  const uploaded = await Promise.all([acceptPdfUpload(ownerId,uploadInput,pdf),acceptPdfUpload(ownerId,uploadInput,pdf)]);
  assert.deepEqual(uploaded[0],uploaded[1]);
  assert.equal(await prisma.cohortTextArtifact.count({where:{workspaceId:uploadWorkspace,kind:'source_input'}}),1);
  assert.equal(cohortWorkspaceSchema.parse((await repo.loadWorkspace({workspaceId:uploadWorkspace,ownerId}))!.snapshot).sources.length,1);
  await assert.rejects(acceptPdfUpload('foreign',uploadInput,pdf),/WORKSPACE_NOT_FOUND/);
  await assert.rejects(acceptPdfUpload(ownerId,uploadInput,Buffer.from('%PDF-different')),/IDEMPOTENCY_MISMATCH/);
  await assert.rejects(acceptPdfUpload(ownerId,{...uploadInput,requestId:crypto.randomUUID()},pdf),/STALE_WORKSPACE/);
  assert.equal(await prisma.cohortTextArtifact.count({where:{workspaceId:uploadWorkspace,kind:'source_input'}}),1);
  await assert.rejects(acceptPdfUpload(ownerId,uploadInput,Buffer.alloc(2*1024*1024+1)),/INVALID_PDF_UPLOAD/);
  const foreignAction = {actionId:crypto.randomUUID(),workspaceId:queueId,expectedRevision:(await repo.loadWorkspace({workspaceId:queueId,ownerId}))!.revision,
    entityVersions:[],action:{type:'add_pdf_source',uploadId:uploaded[0].uploadId,label:'Foreign upload'}};
  await assert.rejects(repo.commitAction({ workspaceId:queueId,ownerId,expectedRevision:foreignAction.expectedRevision,envelope:foreignAction,plan:planCohortAction }),/ARTIFACT_NOT_FOUND/);
  process.env.INTERACTION_PDF_ENABLED='0';
  await assert.rejects(acceptPdfUpload(ownerId,{...uploadInput,requestId:crypto.randomUUID(),expectedRevision:1},pdf),/SOURCE_CAPABILITY_DISABLED/);
  assert(await repo.loadWorkspace({workspaceId:uploadWorkspace,ownerId}));
  console.log('PASS PDF owned atomic upload, concurrent replay, foreign refs, limits, stale rollback and capability gate');
  // Retire only this run's synthetic graphs before exercising global claims again.
  await pool.query(`UPDATE cohort_text_jobs SET status='canceled',"leaseToken"=NULL,"leaseUntil"=NULL,"leaseOwner"=NULL
    WHERE "workspaceId" IN (SELECT id FROM interaction_workspaces WHERE "ownerId"=$1) AND status IN ('queued','running','failed')`,[ownerId]);
  process.env.INTERACTION_PDF_ENABLED='1';
  const externalId=crypto.randomUUID();await repo.createWorkspace({id:externalId,ownerId,domainId:'cohort',domainVersion:1,initialSnapshot:snapshot});
  const {sourcePdf}=await import('../src/server/domain/cohort-builder/__tests__/source-fixture');
  await acceptPdfUpload(ownerId,{workspaceId:externalId,requestId:crypto.randomUUID(),expectedRevision:0,label:'Real PDF'},sourcePdf(['Quorum overlap prevents conflict.','Majorities retain decisions.']));
  const webAction={actionId:crypto.randomUUID(),workspaceId:externalId,expectedRevision:1,entityVersions:[],action:{type:'add_web_source',sourceId:'web',label:'Real web',url:'https://docs.example.org/quorums'}};
  await repo.commitAction({workspaceId:externalId,ownerId,expectedRevision:1,requestId:crypto.randomUUID(),envelope:webAction,plan:planCohortAction});
  now=new Date(Date.now()+2000);
  const externalClaims=await Promise.all([claimTextJob(sql,'pdf-claim',now,1000),claimTextJob(sql,'web-claim',now,1000)]);
  assert(externalClaims.every(Boolean));assert.notEqual(externalClaims[0]!.id,externalClaims[1]!.id);
  now=new Date(now.getTime()+1001);
  const {createTextSourceProcessor}=await import('../src/server/domain/cohort-builder/text-source-processor');
  const webOpen=async()=>({status:200,headers:{'content-type':'text/plain'},bytes:(async function*(){yield Buffer.from('Majority voting provides overlap.');})(),close:()=>{}});
  const webTransport={resolve:async()=>[{address:'93.184.216.34',family:4}],open:webOpen};
  const loadWorkspace=async()=> (await repo.loadWorkspace({workspaceId:externalId,ownerId}))!.snapshot;
  for(const old of externalClaims) {
    const bytes=await createTextSourceProcessor({sql,loadWorkspace,webTransport})(old!);
    const artifact=await putTextArtifact(sql,{workspaceId:externalId,sourceId:old!.sourceId!,sourceVersion:old!.sourceVersion!,kind:'source_raw',inputFingerprint:old!.dependencyFingerprint,bytes});
    assert.equal(await acceptCurrentTextJob(port,old!,artifact,now),false,'Expired acquisition must not project retained identity');
  }
  for(let i=0;i<11;i++) {
    const result=await runDurableTextJobTick({sql,transaction:port,workerId:'external-replacement',leaseMs:60000,now:()=>now,loadWorkspace,webTransport});
    assert.equal(result.status,'accepted',JSON.stringify(result));
  }
  const external=cohortWorkspaceSchema.parse(await loadWorkspace());assert.equal(external.processing.status,'ready');assert.equal(external.lessons.length,3);
  assert.deepEqual(external.sources[0].locations?.map(item=>item.page),[1,2]);assert.equal(external.sources[1].provenance?.finalUrl,webAction.action.url);
  const externalSnapshot=(await repo.loadWorkspace({workspaceId:externalId,ownerId}))!;
  const externalEvents=await repo.queryEvents({workspaceId:externalId,ownerId,afterSequence:0,limit:100});
  assert.equal(externalEvents.length,externalSnapshot.sequence);assert.equal(externalSnapshot.revision,externalSnapshot.sequence);
  console.log('PASS separate PostgreSQL PDF/web claims, expired acquisition fences, retained extraction, assembly and event consistency');

  // --- S4C YouTube transcript verification ---
  await pool.query(`UPDATE cohort_text_jobs SET status='canceled',"leaseToken"=NULL,"leaseUntil"=NULL,"leaseOwner"=NULL
    WHERE "workspaceId" IN (SELECT id FROM interaction_workspaces WHERE "ownerId"=$1) AND status IN ('queued','running','failed')`,[ownerId]);

  // 1. Disability proof: without INTERACTION_YOUTUBE_ENABLED/mock, action is rejected
  const ytDisabledWorkspace = crypto.randomUUID();
  await repo.createWorkspace({ id: ytDisabledWorkspace, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: snapshot });
  const ytVideoUrl = 'https://www.youtube.com/watch?v=s4cVideo123';
  const ytTrack = { id: 'en-manual', language: 'en', kind: 'manual' as const, translated: false as const };
  const ytAction = {
    actionId: crypto.randomUUID(), workspaceId: ytDisabledWorkspace, expectedRevision: 0, entityVersions: [],
    action: { type: 'add_youtube_source' as const, sourceId: 'yt-source', label: 'YouTube Video', url: ytVideoUrl, track: ytTrack },
  };
  await assert.rejects(
    repo.commitAction({ workspaceId: ytDisabledWorkspace, ownerId, expectedRevision: 0, envelope: ytAction, plan: planCohortAction }),
    /SOURCE_CAPABILITY_DISABLED/,
    'YouTube intake must be rejected when capability is disabled'
  );

  // 2. Enable test mock capability
  process.env.INTERACTION_YOUTUBE_ENABLED = '1';
  process.env.INTERACTION_YOUTUBE_TEST_MOCK = '1';
  const ytId = crypto.randomUUID();
  await repo.createWorkspace({ id: ytId, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: snapshot });
  const ytCommitAction = {
    actionId: crypto.randomUUID(), workspaceId: ytId, expectedRevision: 0, entityVersions: [],
    action: { type: 'add_youtube_source' as const, sourceId: 'yt-source', label: 'Consensus Talk', url: ytVideoUrl, track: ytTrack },
  };
  await repo.commitAction({ workspaceId: ytId, ownerId, expectedRevision: 0, requestId: crypto.randomUUID(), envelope: ytCommitAction, plan: planCohortAction });

  // Mock transcript provider
  const rawTranscript = {
    format: 'youtube-transcript-v1',
    provider: { id: 'mock-fixture', version: '1' },
    acquiredAt: '2026-10-14T00:00:00.000Z',
    video: { id: 's4cVideo123', url: ytVideoUrl, durationMs: 60_000, visibility: 'public', state: 'complete' },
    track: ytTrack,
    segments: [
      { startMs: 0, endMs: 5000, text: 'Quorums overlap and provide consensus.' },
      { startMs: 6000, endMs: 12000, text: 'Majorities retain immutable decisions.' },
    ],
  };
  const rawBytes = Buffer.from(JSON.stringify(rawTranscript));
  let providerCallCount = 0;
  const youtubeProvider = {
    id: 'mock-fixture', version: '1', billing: 'none' as const,
    open: async () => {
      providerCallCount++;
      return {
        mediaType: 'application/json' as const,
        bytes: (async function* () { yield rawBytes; })(),
        close: () => {},
      };
    },
  };

  const loadYtWorkspace = async () => (await repo.loadWorkspace({ workspaceId: ytId, ownerId }))!.snapshot;
  now = new Date(Date.now() + 2000);

  // Drain DAG ticks for YouTube: acquisition, extraction, chunking, analysis, assembly
  for (let i = 0; i < 6; i++) {
    const res = await runDurableTextJobTick({
      sql, transaction: port, workerId: 'yt-worker', leaseMs: 60000, now: () => now,
      loadWorkspace: loadYtWorkspace, youtubeTranscriptProvider: youtubeProvider,
    });
    if (res.status !== 'accepted') break;
  }

  const ytWorkspace = cohortWorkspaceSchema.parse(await loadYtWorkspace());
  assert.equal(ytWorkspace.processing.status, 'ready');
  assert.equal(ytWorkspace.sources.length, 1);
  assert.equal(ytWorkspace.sources[0].locations?.length, 2);
  assert.equal(ytWorkspace.sources[0].locations![0].startMs, 0);
  assert.equal(ytWorkspace.sources[0].locations![0].endMs, 5000);
  assert.equal(ytWorkspace.sources[0].provenance?.parserVersion, 'youtube-transcript-v1');
  assert.equal(providerCallCount, 1, 'Provider should have been called exactly once for acquisition');

  // Scope reduction: verify scope reuses retained raw bytes without refetching from provider
  const currentYt = (await repo.loadWorkspace({ workspaceId: ytId, ownerId }))!;
  const ytScopeAction = {
    actionId: crypto.randomUUID(), workspaceId: ytId, expectedRevision: currentYt.revision,
    entityVersions: [{ kind: 'source' as const, id: 'yt-source', version: ytWorkspace.sources[0].version }],
    action: { type: 'set_youtube_scope' as const, sourceId: 'yt-source', scope: { startMs: 6000, endMs: 12000 } },
  };
  await repo.commitAction({ workspaceId: ytId, ownerId, expectedRevision: currentYt.revision, requestId: crypto.randomUUID(), envelope: ytScopeAction, plan: planCohortAction });

  for (let i = 0; i < 6; i++) {
    const res = await runDurableTextJobTick({
      sql, transaction: port, workerId: 'yt-worker', leaseMs: 60000, now: () => now,
      loadWorkspace: loadYtWorkspace, youtubeTranscriptProvider: youtubeProvider,
    });
    if (res.status !== 'accepted') break;
  }

  assert.equal(providerCallCount, 1, 'Provider must NOT be called again when adjusting transcript scope');
  const scopedYtWorkspace = cohortWorkspaceSchema.parse(await loadYtWorkspace());
  assert.equal(scopedYtWorkspace.processing.status, 'ready');
  assert.equal(scopedYtWorkspace.sources[0].locations?.length, 1);
  assert.equal(scopedYtWorkspace.sources[0].locations![0].startMs, 6000);
  assert.equal(scopedYtWorkspace.sources[0].locations![0].endMs, 12000);

  const ytEvents = await repo.queryEvents({ workspaceId: ytId, ownerId, afterSequence: 0, limit: 100 });
  const ytSnapshot = (await repo.loadWorkspace({ workspaceId: ytId, ownerId }))!;
  assert.equal(ytEvents.length, ytSnapshot.sequence);
  assert.equal(ytSnapshot.revision, ytSnapshot.sequence);
  console.log('PASS separate PostgreSQL YouTube disability, intake, timestamp extraction, scope reuse, and event consistency');

  // 3. Live provider test against authorized local mock service
  let liveServerRequests = 0;
  const liveServer = createServer((req, res) => {
    liveServerRequests++;
    if (liveServerRequests === 1) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '0' });
      res.end(JSON.stringify({ error: 'rate_limited' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      segments: [
        { startMs: 0, endMs: 5000, text: 'Consensus protocols require overlap.' },
        { startMs: 6000, endMs: 12000, text: 'Majorities commit transactions.' },
      ],
    }));
  });
  await new Promise<void>(resolve => liveServer.listen(0, '127.0.0.1', () => resolve()));
  const liveServerPort = (liveServer.address() as any).port;
  const liveEndpoint = `http://127.0.0.1:${liveServerPort}/transcript`;
  const liveProvider = new LiveYoutubeTranscriptProvider({
    endpoint: liveEndpoint,
    token: 'test-token',
    initialBackoffMs: 5,
    maxRetries: 2,
  });

  const ytLiveId = crypto.randomUUID();
  await repo.createWorkspace({ id: ytLiveId, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: snapshot });
  const ytLiveAction = {
    actionId: crypto.randomUUID(), workspaceId: ytLiveId, expectedRevision: 0, entityVersions: [],
    action: { type: 'add_youtube_source' as const, sourceId: 'yt-live-source', label: 'Live Consensus', url: ytVideoUrl, track: ytTrack },
  };
  await repo.commitAction({ workspaceId: ytLiveId, ownerId, expectedRevision: 0, requestId: crypto.randomUUID(), envelope: ytLiveAction, plan: planCohortAction });

  const loadYtLiveWorkspace = async () => (await repo.loadWorkspace({ workspaceId: ytLiveId, ownerId }))!.snapshot;
  for (let i = 0; i < 6; i++) {
    const res = await runDurableTextJobTick({
      sql, transaction: port, workerId: 'yt-live-worker', leaseMs: 60000, now: () => now,
      loadWorkspace: loadYtLiveWorkspace, youtubeTranscriptProvider: liveProvider,
    });
    if (res.status !== 'accepted') break;
  }
  await new Promise<void>((resolve, reject) => liveServer.close(err => err ? reject(err) : resolve()));

  assert.equal(liveServerRequests, 2, 'Live provider should have retried on 429 and succeeded on second attempt');
  const ytLiveWorkspace = cohortWorkspaceSchema.parse(await loadYtLiveWorkspace());
  assert.equal(ytLiveWorkspace.processing.status, 'ready');
  assert.equal(ytLiveWorkspace.sources[0].locations?.length, 2);
  console.log('PASS LiveYoutubeTranscriptProvider acquisition, rate-limit backoff, and end-to-end DAG execution');

  // --- S4D GitHub repository verification ---
  await pool.query(`UPDATE cohort_text_jobs SET status='canceled',"leaseToken"=NULL,"leaseUntil"=NULL,"leaseOwner"=NULL
    WHERE "workspaceId" IN (SELECT id FROM interaction_workspaces WHERE "ownerId"=$1) AND status IN ('queued','running','failed')`,[ownerId]);

  // 1. Disability proof: without INTERACTION_GITHUB_ENABLED/mock, action is rejected
  const ghDisabledWorkspace = crypto.randomUUID();
  await repo.createWorkspace({ id: ghDisabledWorkspace, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: snapshot });
  const ghRepoUrl = 'https://github.com/sidequesthq/undone';
  const ghAction = {
    actionId: crypto.randomUUID(), workspaceId: ghDisabledWorkspace, expectedRevision: 0, entityVersions: [],
    action: { type: 'add_github_source' as const, sourceId: 'gh-source', label: 'GitHub Repo', repoUrl: ghRepoUrl, ref: 'main', paths: ['README.md', 'src/consensus.ts'] },
  };
  await assert.rejects(
    repo.commitAction({ workspaceId: ghDisabledWorkspace, ownerId, expectedRevision: 0, envelope: ghAction, plan: planCohortAction }),
    /SOURCE_CAPABILITY_DISABLED/,
    'GitHub intake must be rejected when capability is disabled'
  );

  // 2. Enable test mock capability
  process.env.INTERACTION_GITHUB_ENABLED = '1';
  process.env.INTERACTION_GITHUB_TEST_MOCK = '1';
  const ghId = crypto.randomUUID();
  await repo.createWorkspace({ id: ghId, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: snapshot });
  const ghCommitAction = {
    actionId: crypto.randomUUID(), workspaceId: ghId, expectedRevision: 0, entityVersions: [],
    action: { type: 'add_github_source' as const, sourceId: 'gh-source', label: 'Consensus Repo', repoUrl: ghRepoUrl, ref: 'main', paths: ['README.md', 'src/consensus.ts'] },
  };
  await repo.commitAction({ workspaceId: ghId, ownerId, expectedRevision: 0, requestId: crypto.randomUUID(), envelope: ghCommitAction, plan: planCohortAction });

  // Mock GitHub provider
  let ghProviderCallCount = 0;
  const mockCommitSha = 'c'.repeat(40);
  const githubProvider = {
    id: 'mock-gh-fixture',
    version: '1',
    billing: 'none' as const,
    resolveRef: async (_repo: { owner: string; repo: string }, _ref: string) => {
      ghProviderCallCount++;
      return { commitSha: mockCommitSha };
    },
    fetchFiles: async (_repo: { owner: string; repo: string }, _commitSha: string, paths: string[]) => {
      const files: Array<{ path: string; content: Uint8Array }> = [];
      for (const p of paths) {
        if (p === 'README.md') {
          files.push({ path: p, content: Buffer.from('# Undone\nQuorums overlap and provide consensus across nodes.\n') });
        } else if (p === 'src/consensus.ts') {
          files.push({ path: p, content: Buffer.from('export function hasQuorum(votes: number, total: number): boolean {\n  return votes > Math.floor(total / 2);\n}\n') });
        }
      }
      return files;
    },
  };

  const loadGhWorkspace = async () => (await repo.loadWorkspace({ workspaceId: ghId, ownerId }))!.snapshot;
  now = new Date(Date.now() + 2000);

  // Drain DAG ticks for GitHub: acquisition, extraction, chunking, analysis, assembly
  for (let i = 0; i < 6; i++) {
    const res = await runDurableTextJobTick({
      sql, transaction: port, workerId: 'gh-worker', leaseMs: 60000, now: () => now,
      loadWorkspace: loadGhWorkspace, githubSourceProvider: githubProvider,
    });
    if (res.status !== 'accepted') break;
  }

  const ghWorkspace = cohortWorkspaceSchema.parse(await loadGhWorkspace());
  assert.equal(ghWorkspace.processing.status, 'ready');
  assert.equal(ghWorkspace.sources.length, 1);
  assert(ghWorkspace.sources[0].locations && ghWorkspace.sources[0].locations.length >= 2);
  assert(ghWorkspace.sources[0].locations.some(loc => loc.filePath === 'README.md' && loc.startLine === 1));
  assert(ghWorkspace.sources[0].locations.some(loc => loc.filePath === 'src/consensus.ts' && loc.startLine === 1));
  assert.equal(ghWorkspace.sources[0].provenance?.parserVersion, 'github-source-v1');
  assert.equal(ghWorkspace.sources[0].provenance?.commitSha, mockCommitSha);
  assert.equal(ghProviderCallCount, 1, 'GitHub provider should have been called once for initial resolution');

  // Scope reduction: verify scope reuses retained raw bytes without refetching from provider
  const currentGh = (await repo.loadWorkspace({ workspaceId: ghId, ownerId }))!;
  const ghScopeAction = {
    actionId: crypto.randomUUID(), workspaceId: ghId, expectedRevision: currentGh.revision,
    entityVersions: [{ kind: 'source' as const, id: 'gh-source', version: ghWorkspace.sources[0].version }],
    action: { type: 'set_github_scope' as const, sourceId: 'gh-source', paths: ['README.md'] },
  };
  await repo.commitAction({ workspaceId: ghId, ownerId, expectedRevision: currentGh.revision, requestId: crypto.randomUUID(), envelope: ghScopeAction, plan: planCohortAction });

  for (let i = 0; i < 6; i++) {
    const res = await runDurableTextJobTick({
      sql, transaction: port, workerId: 'gh-worker', leaseMs: 60000, now: () => now,
      loadWorkspace: loadGhWorkspace, githubSourceProvider: githubProvider,
    });
    if (res.status !== 'accepted') break;
  }

  assert.equal(ghProviderCallCount, 1, 'GitHub provider must NOT be called again when adjusting file scope');
  const scopedGhWorkspace = cohortWorkspaceSchema.parse(await loadGhWorkspace());
  assert.equal(scopedGhWorkspace.processing.status, 'ready');
  assert.equal(scopedGhWorkspace.sources[0].locations?.length, 1);
  assert.equal(scopedGhWorkspace.sources[0].locations![0].filePath, 'README.md');

  const ghEvents = await repo.queryEvents({ workspaceId: ghId, ownerId, afterSequence: 0, limit: 100 });
  const ghSnapshot = (await repo.loadWorkspace({ workspaceId: ghId, ownerId }))!;
  assert.equal(ghEvents.length, ghSnapshot.sequence);
  assert.equal(ghSnapshot.revision, ghSnapshot.sequence);
  console.log('PASS separate PostgreSQL GitHub disability, intake, line-anchored extraction, scope reuse, and event consistency');

  // --- S5 Verification: Learner Delivery and Workspace Release ---
  await pool.query(readFileSync('prisma/interaction-s5-effects.sql', 'utf8'));
  const { releaseWorkspace } = await import('../src/server/domain/cohort-builder/release-service');

  // 1. Private Activation release
  const privateRelease = await releaseWorkspace(prisma, {
    workspaceId: ghId,
    ownerId,
    mode: 'private_activation',
  });

  assert(privateRelease.receipt);
  assert.equal(privateRelease.receipt.mode, 'private_activation');
  assert.equal(privateRelease.receipt.destinationUrl, `/play?cohort=${privateRelease.receipt.cohortId}`);

  // Verify relational Prisma records
  const releasedCohort = await prisma.cohort.findUnique({
    where: { id: privateRelease.receipt.cohortId },
  });
  assert(releasedCohort);
  assert.equal(releasedCohort.visibility, 'PRIVATE');
  assert.equal(releasedCohort.creatorId, ownerId);

  const releasedSeason = await prisma.season.findFirst({
    where: { cohortId: releasedCohort.id },
  });
  assert(releasedSeason);

  const releasedLessons = await prisma.lesson.findMany({
    where: { seasonId: releasedSeason.id },
  });
  assert.equal(releasedLessons.length, scopedGhWorkspace.lessons.length);

  const ownerMembership = await prisma.cohortMember.findFirst({
    where: { cohortId: releasedCohort.id, userId: ownerId },
  });
  assert(ownerMembership);
  assert.equal(ownerMembership.role, 'CREATOR');

  const effectRow = await pool.query(
    'SELECT * FROM interaction_effects WHERE "effectKey" = $1',
    [privateRelease.receipt.effectKey]
  );
  assert.equal(effectRow.rows.length, 1);
  assert.equal(effectRow.rows[0].state, 'committed');

  // Verify workspace snapshot and event
  const releasedWsRow = (await repo.loadWorkspace({ workspaceId: ghId, ownerId }))!;
  const releasedWs = cohortWorkspaceSchema.parse(releasedWsRow.snapshot);
  assert.equal(releasedWs.release?.status, 'released');
  assert.equal(releasedWs.release?.cohortId, privateRelease.receipt.cohortId);

  // 2. Release Idempotency: re-releasing private activation produces identical receipt
  const reRelease = await releaseWorkspace(prisma, {
    workspaceId: ghId,
    ownerId,
    mode: 'private_activation',
  });
  assert.equal(reRelease.receipt.effectKey, privateRelease.receipt.effectKey);
  assert.equal(reRelease.receipt.cohortId, privateRelease.receipt.cohortId);
  assert.equal(reRelease.revision, privateRelease.revision);

  // 3. Promotion to Public Publish: in-place promotion under identical cohortId
  const publicRelease = await releaseWorkspace(prisma, {
    workspaceId: ghId,
    ownerId,
    mode: 'public_publish',
  });
  assert.equal(publicRelease.receipt.cohortId, privateRelease.receipt.cohortId);
  assert.equal(publicRelease.receipt.mode, 'public_publish');
  assert.equal(publicRelease.receipt.destinationUrl, `/cohort/${publicRelease.receipt.cohortId}`);

  const promotedCohort = await prisma.cohort.findUnique({
    where: { id: publicRelease.receipt.cohortId },
  });
  assert.equal(promotedCohort?.visibility, 'PUBLIC');

  // 4. Downgrade Prevention: Attempting to downgrade public cohort back to private must fail
  let downgradeBlocked = false;
  try {
    await releaseWorkspace(prisma, {
      workspaceId: ghId,
      ownerId,
      mode: 'private_activation',
    });
  } catch (error) {
    if ((error as Error).message.includes('CANNOT_DOWNGRADE_PUBLIC_COHORT')) {
      downgradeBlocked = true;
    }
  }
  assert.equal(downgradeBlocked, true, 'Downgrading a public cohort must be blocked');

  // 5. Block unredacted restricted sources from public release
  const restrictedWsId = crypto.randomUUID();
  const restrictedSnapshot = cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Secret Internal Cohort',
    intent: 'Internal procedures',
    audience: 'Employees',
    dailyMinutes: 15,
    lessons: [
      { id: 'sec-1', version: 0, title: 'Secrets', objective: 'Keep private', sourceChunkIds: ['src-sec:v0:0'], pinned: false },
    ],
    sources: [
      { id: 'src-sec', version: 0, label: 'Confidential Notes', text: 'Private key data', checksum: 'd'.repeat(64), state: 'ready', isRestricted: true },
    ],
    chunks: [
      { id: 'src-sec:v0:0', sourceId: 'src-sec', sourceVersion: 0, start: 0, end: 16, text: 'Private key data', checksum: 'e'.repeat(64) },
    ],
    processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'sec-fp', error: null },
  });
  await repo.createWorkspace({ id: restrictedWsId, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: restrictedSnapshot });

  let restrictedBlocked = false;
  try {
    await releaseWorkspace(prisma, {
      workspaceId: restrictedWsId,
      ownerId,
      mode: 'public_publish',
    });
  } catch (error) {
    if ((error as Error).name === 'CohortReadinessError') {
      restrictedBlocked = true;
    }
  }
  assert.equal(restrictedBlocked, true, 'Public release with restricted sources must be blocked by readiness check');

  console.log('PASS separate PostgreSQL S5 learner delivery, relational materialization, promotion, downgrade prevention, and restricted source blocking');
} finally { await pool.end(); await prisma.$disconnect(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
