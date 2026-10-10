/** SQL-only publication checks. Retained artifact bodies are fixture data, never live AI/Mongo reads. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import type { PrismaClient } from '../generated/prisma/client';
import { creationSnapshotSchema, type CreationSnapshot } from '../src/shared/cohort-creation/contracts';
import { generatedCurriculumSchema } from '../src/shared/cohort-creation/artifacts';
import { applyCommand, applyEvent } from '../src/shared/cohort-creation/flow';
import { deliveryArtifactSchema, publicationCheckpointSchema, type DeliveryArtifact } from '../src/shared/cohort-creation/publication';
import { PEDAGOGICAL_DIMENSIONS } from '../src/shared/curriculum/pedagogicalVector.types';
import { rebaseReview } from '../src/server/domain/cohort-creation/review.service';
import { PublicationService, publicationArtifactFingerprint, publicationLessonId } from '../src/server/domain/cohort-creation/publication.service';
import { createCreationJobRepository } from '../src/server/infrastructure/db/postgres/repositories/creationJob.repo';
import { createCreationDraftRepository } from '../src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import { createCreationConversationRepository } from '../src/server/infrastructure/db/postgres/repositories/creationConversation.repo';
import { JobBudgetExceeded } from '../src/server/domain/cohort-creation/durable-job';
import { jobCompletion } from '../src/server/domain/cohort-creation/job-completion';

export async function setupPublicationSmokeSchema(pool: Pool) {
  // Generate from the checked-in schema. Execute ONLY allowlisted unqualified statements
  // on the existing disposable-schema connection; never the generated CREATE SCHEMA public.
  const ddl = execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)),
    'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const tables = new Set(['cohorts', 'cohort_sources', 'seasons', 'lessons', 'communities', 'channels', 'cohort_members']);
  for (const statement of ddl.split(';').map(item => item.replace(/--[^\n]*/g, '').trim()).filter(Boolean)) {
    const type = /^CREATE TYPE "([A-Za-z]+)" AS ENUM/.exec(statement);
    const table = /^CREATE TABLE "([a-z_]+)"/.exec(statement);
    const index = /^CREATE (?:UNIQUE )?INDEX "[^"]+" ON "([a-z_]+)"/.exec(statement);
    const foreign = /^ALTER TABLE "([a-z_]+)" ADD CONSTRAINT/.exec(statement);
    if (type || table && tables.has(table[1]) || index && tables.has(index[1]) || foreign && tables.has(foreign[1])) {
      assert.ok(!statement.includes('"public".'), 'fixture statements must remain within the isolated search path');
      await pool.query(statement);
    }
  }
  for (const file of ['creation-review.sql', 'creation-publication.sql']) await pool.query(await readFile(new URL(`../prisma/${file}`, import.meta.url), 'utf8'));
}

export async function runPublicationSmoke(db: PrismaClient, pool: Pool, owner: string, ready: CreationSnapshot) {
  const drafts = createCreationDraftRepository(db); const bodies = new Map<string, DeliveryArtifact>();
  const store = {
    getJSON: async (_scope: { ownerId: string; draftId: string }, id: string) => {
      const body = bodies.get(id); assert.ok(body, 'retained fixture body must exist'); return deliveryArtifactSchema.parse(body);
    },
    ref: async (scope: { ownerId: string; draftId: string }, id: string) => {
      const row = await db.creationStorageObject.findFirst({ where: { id, ownerId: scope.ownerId, draftId: scope.draftId, status: 'ready', kind: 'artifact' } });
      assert.ok(row, 'only owned retained fixture metadata may be read');
      return { id: row.id, kind: 'artifact' as const, checksum: row.checksum!, byteLength: row.byteLength! };
    },
    putJSON: async () => { throw new Error('SQL smoke does not generate artifact bodies'); },
  };
  const service = new PublicationService({ load: async () => { throw new Error('Complete-checkpoint SQL recovery cannot rebuild'); } }, store as never);
  const repo = createCreationJobRepository(db, async (scope, snapshot, checkpoint) => service.loadPrepared(scope, snapshot, checkpoint, new AbortController().signal));
  const curriculum = generatedCurriculumSchema.parse({ version: ready.processing!.building!.checkpoint!.inputFingerprint, inputRevision: ready.inputRevision,
    title: { value: 'SQL reviewed curriculum', origin: 'ai', acceptedRevision: ready.inputRevision },
    description: { value: 'SQL-only retained delivery fixture', origin: 'user', acceptedRevision: ready.inputRevision }, warnings: [],
    seasons: [{ id: 'fixture-season', title: { value: 'Retained source', origin: 'ai', acceptedRevision: ready.inputRevision }, order: 0,
      lessons: ['lesson-one', 'lesson-two', 'lesson-three'].map((id, order) => ({ id, order, type: 'ARTICLE',
        title: { value: `Retained lesson ${order + 1}`, origin: 'ai', acceptedRevision: ready.inputRevision },
        objectives: { value: ['Observe retained source evidence'], origin: 'ai', acceptedRevision: ready.inputRevision },
        chunkIds: [`chunk-${id}`], materialIds: [ready.materials[0].id], durationSeconds: 60 })) }] });
  let state = creationSnapshotSchema.parse({ ...ready, revision: ready.revision + 1, stage: 'review', review: rebaseReview(curriculum, null) });
  assert.equal(await drafts.swap(owner, ready.draftId, ready.revision, state), true, 'owned review is durably stored');
  assert.equal(await drafts.load('foreign-owner', ready.draftId), null);
  const refine = applyCommand(state, { type: 'refine_curriculum', requestId: randomUUID(), prompt: 'Clarify the title' });
  assert.ok(await repo.enqueue(owner, state, refine)); assert.ok(await repo.enqueue(owner, state, refine));
  const refinement = await repo.claim('sql-review'); assert.ok(refinement?.kind === 'refine_curriculum');
  for (let count = 0; count < 2; count++) { const release = await repo.reserveModelCall(refinement); assert.ok(release); await release(); }
  await assert.rejects(repo.reserveModelCall(refinement), JobBudgetExceeded);
  const proposal = { requestId: refinement.requestId, inputRevision: state.inputRevision, baseEditRevision: state.review!.editRevision,
    buildFingerprint: state.review!.buildFingerprint, proposal: { message: 'A bounded proposal', changes: [{ type: 'title' as const, value: 'Reviewed SQL title' }] } };
  assert.equal(await repo.checkpoint(refinement, proposal), true);
  assert.equal(await repo.finish(refinement, jobCompletion(refinement, proposal)), true);
  assert.equal(await repo.finish(refinement, jobCompletion(refinement, proposal)), false, 'duplicate completion cannot duplicate conversation');
  const conversation = createCreationConversationRepository(db);
  const entries = await conversation.list(owner, ready.draftId);
  assert.equal(entries.length, 2); assert.equal(new Set(entries.map(entry => entry.role)).size, 2);
  assert.equal((await conversation.list('foreign-owner', ready.draftId)).length, 0);
  state = (await drafts.load(owner, ready.draftId))!;
  const accepted = applyCommand(state, { type: 'apply_refinement', requestId: refinement.requestId });
  assert.equal(await drafts.swap(owner, state.draftId, state.revision, accepted), true); state = accepted;

  async function prepare(mode: 'private_activation' | 'public_publish') {
    const next = applyCommand(state, { type: 'finalize_creation', requestId: randomUUID(), mode });
    const queued = await repo.enqueue(owner, state, next); assert.ok(queued); assert.ok(queued.publication?.cohortId);
    assert.equal(await repo.enqueue('foreign-owner', state, next), null);
    assert.equal((await repo.enqueue(owner, state, next))?.publication?.cohortId, queued.publication.cohortId, 'lost enqueue response reuses identity');
    assert.equal(await db.creationJob.count({ where: { draftId: state.draftId, requestId: next.activeRequestId! } }), 1);
    const job = await repo.claim('sql-publication'); assert.ok(job?.kind === 'finalize_creation');
    await db.creationJob.update({ where: { id: job.id }, data: { leaseUntil: new Date(Date.now() + 600_000) } });
    const checkpoint = publicationCheckpointSchema.parse({ phase: 'publication', requestId: job.requestId, mode, cohortId: job.input.cohortId,
      snapshotHash: job.input.snapshotHash, total: curriculum.seasons[0].lessons.length, lessonIds: curriculum.seasons[0].lessons.map(lesson => lesson.id), completed: [] });
    assert.equal(await repo.checkpoint(job, checkpoint), true);
    for (const [index, lessonId] of checkpoint.lessonIds.entries()) {
      const id = randomUUID(); const ref = { id, kind: 'artifact' as const, checksum: 'a'.repeat(64), byteLength: 400 };
      const body = deliveryArtifactSchema.parse({ schemaVersion: 1, requestId: job.requestId, snapshotHash: checkpoint.snapshotHash, cohortId: checkpoint.cohortId,
        lessonId: publicationLessonId(checkpoint.cohortId, lessonId), sourceLessonId: lessonId, buildingFingerprint: curriculum.version,
        title: `Retained lesson ${index + 1}`, objectives: ['Observe actual retained fixture text'], chunks: [{ id: `chunk-${lessonId}`, title: 'Fixture chunk', text: 'Actual retained SQL fixture text.',
          sourceRefs: [{ materialId: ready.materials[0].id, unitId: ready.materials[0].selectedUnitIds[0], segmentId: 'segment', anchor: { kind: 'text', start: 0, end: 33 } }],
          contentOrigin: 'user', coverage: { scope: 'retained SQL fixture', exhaustive: true, limitations: [] }, durationSeconds: 60, durationMethod: 'reading_estimate',
          vector: Object.fromEntries(PEDAGOGICAL_DIMENSIONS.map(key => [key, 0.5])), isStrictlyLinear: true, order: 0 }] });
      bodies.set(id, body);
      await db.creationStorageObject.create({ data: { ...ref, ownerId: owner, draftId: ready.draftId, blobId: randomUUID(), status: 'ready', mediaType: 'application/json',
        reservedBytes: ref.byteLength, artifactType: 'creation-delivery', schemaVersion: 1, inputFingerprint: publicationArtifactFingerprint(checkpoint.snapshotHash, lessonId) } });
      checkpoint.completed.push({ lessonId, artifact: ref });
      assert.equal(await repo.checkpoint(job, checkpoint), true);
    }
    state = (await drafts.load(owner, ready.draftId))!;
    return { job, checkpoint: publicationCheckpointSchema.parse(checkpoint) };
  }

  const privateOp = await prepare('private_activation');
  assert.equal(await db.cohort.count({ where: { id: privateOp.checkpoint.cohortId } }), 0, 'prepared artifacts do not create discoverable staged cohorts');
  const retained = ready.processing!.building!.checkpoint!.completed[0].artifact.id;
  await db.creationStorageObject.update({ where: { id: retained }, data: { status: 'failed' } });
  await assert.rejects(repo.finish(privateOp.job, jobCompletion(privateOp.job, privateOp.checkpoint)), /source artifacts unavailable/);
  assert.equal(await db.cohort.count({ where: { id: privateOp.checkpoint.cohortId } }), 0, 'SQL materialization rolls back when any source pin fails');
  const uncommitted = await pool.query('SELECT "receipt" FROM "creation_publications" WHERE "draftId"=$1 AND "requestId"=$2', [ready.draftId, privateOp.job.requestId]);
  assert.equal(uncommitted.rows[0].receipt, null, 'receipt rolls back with cohort');
  assert.equal((await db.creationJob.findUniqueOrThrow({ where: { id: privateOp.job.id } })).status, 'running');
  await db.creationStorageObject.update({ where: { id: retained }, data: { status: 'ready' } });
  await db.creationJob.update({ where: { id: privateOp.job.id }, data: { leaseUntil: new Date(0) } });
  const restarted = await repo.claim('sql-publication-restart'); assert.ok(restarted?.kind === 'finalize_creation');
  assert.notEqual(restarted.leaseToken, privateOp.job.leaseToken);
  assert.equal(await repo.checkpoint(privateOp.job, privateOp.checkpoint), false, 'stale worker cannot write publication checkpoints');
  assert.equal(await repo.finish(privateOp.job, jobCompletion(privateOp.job, privateOp.checkpoint)), false, 'stale worker cannot publish');
  assert.equal(await repo.finish(restarted, jobCompletion(restarted, privateOp.checkpoint)), true);
  state = (await drafts.load(owner, ready.draftId))!;
  assert.equal(state.stage, 'published'); assert.equal(state.publication!.receipt!.mode, 'private_activation');
  const cohortId = state.publication!.receipt!.cohortId;
  assert.equal((await db.cohort.findUniqueOrThrow({ where: { id: cohortId } })).visibility, 'PRIVATE');
  assert.equal(await db.lesson.count({ where: { season: { cohortId } } }), 3);
  assert.equal(await repo.finish(restarted, jobCompletion(restarted, privateOp.checkpoint)), false, 'lost publication response does not rematerialize');
  const promotion = await prepare('public_publish'); assert.equal(promotion.checkpoint.cohortId, cohortId);
  assert.equal(await repo.finish(promotion.job, jobCompletion(promotion.job, promotion.checkpoint)), true);
  state = (await drafts.load(owner, ready.draftId))!;
  assert.equal(state.publication!.receipt!.cohortId, cohortId); assert.equal(state.publication!.receipt!.mode, 'public_publish');
  assert.equal((await db.cohort.findUniqueOrThrow({ where: { id: cohortId } })).visibility, 'PUBLIC');
  assert.equal(await db.cohort.count({ where: { id: cohortId } }), 1); assert.equal(await db.lesson.count({ where: { season: { cohortId } } }), 3);
  assert.throws(() => applyCommand(state, { type: 'finalize_creation', requestId: randomUUID(), mode: 'private_activation' }), /not available/);
}
