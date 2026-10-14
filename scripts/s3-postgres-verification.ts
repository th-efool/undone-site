/** Opt-in isolated PostgreSQL verification. Refuses non-loopback/non-test databases. */
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { cohortWorkspaceSchema, planCohortAction } from '../src/shared/cohort-builder/contracts';
import { claimTextJob } from '../src/server/domain/cohort-builder/text-jobs';
import { putTextArtifact } from '../src/server/domain/cohort-builder/text-artifacts';
import { acceptCurrentTextJob } from '../src/server/domain/cohort-builder/text-job-acceptance';
import { runDurableTextJobTick } from '../src/server/domain/cohort-builder/durable-text-worker';
import type { TextJobTransactionPort } from '../src/server/domain/cohort-builder/text-job-scheduler';

async function main() {
const url = new URL(process.env.S3_TEST_DATABASE_URL ?? '');
assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.startsWith('/s3test'), 'Isolated loopback s3test database required');
process.env.DATABASE_URL = url.toString();
process.env.INTERACTION_TEXT_DRIVER = 'durable';
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
} finally { await pool.end(); await prisma.$disconnect(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
