/** Opt-in real SQL smoke test. Uses and removes only a newly created isolated schema.
 * No public migrations, model calls, Mongo access, or existing application records.
 */
import assert, { AssertionError } from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { createCreationJobRepository } from '../src/server/infrastructure/db/postgres/repositories/creationJob.repo';
import { prisma as defaultPrisma } from '../src/server/infrastructure/db/postgres/client';
import { applyCommand, initialSnapshot } from '../src/shared/cohort-creation/flow';
import { CreationFailure } from '../src/server/domain/cohort-creation/errors';
import { createCreationRetentionRepository } from '../src/server/infrastructure/db/postgres/repositories/creationRetention.repo';
import { createCreationStorageMetadata } from '../src/server/infrastructure/storage/creation.metadata';
import { creationSnapshotSchema, type RecommendationResult } from '../src/shared/cohort-creation/contracts';
import { TextAcquisitionService } from '../src/server/domain/cohort-creation/materials/text-acquisition.service';
import { executeCreationJob } from '../src/server/domain/cohort-creation/durable-job.runner';

let stage = 'connection';
async function main() {
  const connectionString = process.env.CREATION_SMOKE_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('A database connection is required');
  const schema = `creation_smoke_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^creation_smoke_[a-f0-9]{32}$/);
  const admin = new Pool({ connectionString, max: 1, query_timeout: 15_000, connectionTimeoutMillis: 10_000 });
  const pool = new Pool({ connectionString, max: 5,
    options: `-c search_path=${schema} -c timezone=UTC`, query_timeout: 15_000, connectionTimeoutMillis: 10_000 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool, { schema }),
    transactionOptions: { maxWait: 30_000, timeout: 30_000 } });
  let created = false;
  try {
    stage = 'isolated schema creation';
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    stage = 'isolated schema setup (requires direct/session database connection)';
    await pool.query('CREATE TABLE "users" ("id" TEXT PRIMARY KEY)');
    for (const file of ['creation-draft.sql', 'creation-durability.sql', 'creation-retention.sql']) {
      await pool.query(await readFile(new URL(`../prisma/${file}`, import.meta.url), 'utf8'));
    }
    stage = 'enqueue and revision checks';
    const owner = randomUUID();
    await pool.query('INSERT INTO "users" ("id") VALUES ($1)', [owner]);
    const repo = createCreationJobRepository(db);
    for (let index = 0; index < 3; index++) {
      const previous = initialSnapshot(randomUUID());
      await db.creationDraft.create({ data: { id: previous.draftId, ownerId: owner, snapshot: previous } });
      const next = applyCommand(previous, { type: 'request_recommendations', query: 'Learn rendering', requestId: randomUUID() });
      const replies = await Promise.all([repo.enqueue(owner, previous, next), repo.enqueue(owner, previous, next)]);
      assert.ok(replies.every(reply => reply?.activeRequestId === next.activeRequestId));
      assert.equal(await db.creationJob.count({ where: { draftId: next.draftId } }), 1);
      assert.equal(await repo.enqueue(randomUUID(), previous, next), null, 'owner mismatch');
      assert.equal(await repo.enqueue(owner, previous, applyCommand(next, {
        type: 'request_recommendations', query: 'Changed query', requestId: randomUUID(),
      })), null, 'stale revision');
    }
    stage = 'concurrent queue claims';
    const claims = await Promise.all([repo.claim('one'), repo.claim('two'), repo.claim('three')]);
    const jobs = claims.filter(job => job !== null);
    assert.equal(jobs.length, 2, 'global job capacity');
    assert.equal(new Set(jobs.map(job => job.id)).size, 2, 'distinct queue claims');
    const job = jobs[0];
    assert.ok(job.kind === 'recommendations');
    // Remote connection latency is not part of the production deadline assertion.
    // Give this test fixture time to inspect slot contention without calling a model.
    job.deadlineAt = new Date(Date.now() + 300_000);
    await db.creationJob.update({ where: { id: job.id }, data: { deadlineAt: job.deadlineAt } });
    stage = 'model slots and fenced release';
    const realNow = Date.now;
    try {
      // Force identical expiry timestamps across reacquisition to exercise the race.
      const fixedNow = Date.now() + 120_000;
      Date.now = () => fixedNow;
      const first = await repo.reserveModelCall(job);
      const second = await repo.reserveModelCall(job);
      assert.equal(typeof first, 'function');
      assert.equal(typeof second, 'function');
      await assert.rejects(repo.reserveModelCall(job), error =>
        error instanceof CreationFailure && error.detail.code === 'RATE_LIMITED');
      await first!();
      const replacement = await repo.reserveModelCall(job);
      await first!(); // delayed duplicate release must not free replacement
      await assert.rejects(repo.reserveModelCall(job), error =>
        error instanceof CreationFailure && error.detail.code === 'RATE_LIMITED');
      await replacement!();
      await second!();
    } finally { Date.now = realNow; }
    stage = 'restart and checkpoint recovery';
    const result: RecommendationResult = {
      requestId: job.requestId, inputRevision: job.inputRevision, items: [], mode: 'ai',
      intent: { id: randomUUID(), rawQuery: job.input.query, revision: job.inputRevision,
        topic: { value: 'Rendering', origin: 'ai', acceptedRevision: job.inputRevision },
        outcomes: { value: ['Understand rendering'], origin: 'ai', acceptedRevision: job.inputRevision },
        level: null, language: null, searchTerms: ['rendering'], uncertainties: [] },
    };
    await db.creationJob.updateMany({ where: { status: 'queued' }, data: { status: 'canceled' } });
    await db.creationJob.update({ where: { id: job.id }, data: { leaseUntil: new Date(0) } });
    const recovered = await repo.claim('restart');
    assert.equal(recovered?.id, job.id, 'restart reclaims expired lease');
    assert.notEqual(recovered?.leaseToken, job.leaseToken);
    assert.equal(await repo.heartbeat(job), false, 'stale heartbeat');
    assert.equal(await repo.checkpoint(job, result), false, 'stale checkpoint');
    assert.equal(await repo.finish(job, { type: 'recommendations_received', result }), false, 'stale completion');
    assert.ok(recovered);
    assert.equal(await repo.checkpoint(recovered, result), true);
    assert.equal(await repo.finish(recovered, { type: 'recommendations_received', result }), true);
    const resumed = await db.creationDraft.findUniqueOrThrow({ where: { id: job.draftId } });
    assert.equal((resumed.snapshot as { status: string }).status, 'succeeded');
    assert.ok(resumed.eventSequence >= 4, 'durable events retained');
    assert.equal(await repo.finish(recovered, { type: 'recommendations_received', result }), false, 'duplicate completion');
    stage = 'durable text acquisition and artifact fencing';
    await db.creationJob.updateMany({ where: { status: { in: ['queued', 'running'] } }, data: { status: 'canceled', leaseToken: null, leaseUntil: null } });
    const accepted = creationSnapshotSchema.parse(resumed.snapshot);
    const starting = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
    // Source bytes are mocked here; only persistence/worker fencing is live verified.
    await db.creationDraft.update({ where: { id: job.draftId }, data: { snapshot: starting, revision: starting.revision } });
    const bytes = Buffer.from('# Rendering\nActual retained SQL fixture content.');
    const sourceRef = { id: randomUUID(), kind: 'upload' as const, byteLength: bytes.length,
      checksum: createHash('sha256').update(bytes).digest('hex') };
    await db.creationStorageObject.create({ data: { ...sourceRef, blobId: randomUUID(), ownerId: owner,
      draftId: job.draftId, status: 'ready', mediaType: 'text/markdown', reservedBytes: bytes.length } });
    const sourceCommand = { type: 'acquire_text' as const, requestId: randomUUID(), materialId: randomUUID(), assetId: sourceRef.id };
    await assert.rejects(repo.enqueue(owner, starting, applyCommand(starting, { ...sourceCommand, assetId: randomUUID() })),
      error => error instanceof CreationFailure && error.detail.code === 'INVALID_REQUEST');
    const queuedText = applyCommand(starting, sourceCommand);
    assert.ok(await repo.enqueue(owner, starting, queuedText));
    assert.ok((await db.creationStorageObject.findUniqueOrThrow({ where: { id: sourceRef.id } })).referencedAt);
    const textJob = await repo.claim('text-worker');
    assert.ok(textJob?.kind === 'acquire_text');
    textJob.deadlineAt = new Date(Date.now() + 300_000);
    await db.creationJob.update({ where: { id: textJob.id }, data: { deadlineAt: textJob.deadlineAt, leaseUntil: new Date(Date.now() + 300_000) } });
    const acquisition = new TextAcquisitionService({ readStream: async () => ({ ref: sourceRef, mediaType: 'text/markdown',
      stream: (async function* () { yield bytes; })() }) }, { putJSON: async (scope, value, options) => {
      const body = Buffer.from(JSON.stringify(value));
      const ref = { id: randomUUID(), kind: 'artifact' as const, byteLength: body.length, checksum: createHash('sha256').update(body).digest('hex') };
      await db.creationStorageObject.create({ data: { ...ref, ...scope, blobId: randomUUID(), status: 'ready',
        mediaType: 'application/json', reservedBytes: body.length, artifactType: options.artifactType,
        schemaVersion: options.schemaVersion, inputFingerprint: options.inputFingerprint } });
      return ref;
    } });
    const manifest = await acquisition.acquire({ ownerId: owner, draftId: job.draftId }, textJob.input.source, textJob.inputRevision);
    await assert.rejects(repo.checkpoint(textJob, { ...manifest, inputFingerprint: 'f'.repeat(64) }));
    await db.creationStorageObject.update({ where: { id: manifest.extractionArtifact.id }, data: { ownerId: 'other-fixture-owner' } });
    await assert.rejects(repo.checkpoint(textJob, manifest), /Checkpoint storage reference unavailable/);
    assert.equal((await db.creationStorageObject.findUniqueOrThrow({ where: { id: manifest.extractionArtifact.id } })).referencedAt, null);
    await db.creationStorageObject.update({ where: { id: manifest.extractionArtifact.id }, data: { ownerId: owner } });
    assert.equal(await repo.checkpoint(textJob, manifest), true);
    await db.creationJob.update({ where: { id: textJob.id }, data: { leaseUntil: new Date(0) } });
    const restoredText = await repo.claim('text-restart');
    assert.ok(restoredText?.kind === 'acquire_text' && restoredText.checkpoint);
    assert.equal(await repo.checkpoint(textJob, manifest), false, 'stale material checkpoint');
    await executeCreationJob(repo, restoredText, () => { throw new Error('No AI expected'); }, new AbortController().signal,
      () => ({ acquire: async () => { throw new Error('Checkpoint must avoid reacquisition'); } }));
    const readyText = creationSnapshotSchema.parse((await db.creationDraft.findUniqueOrThrow({ where: { id: job.draftId } })).snapshot);
    assert.equal(readyText.materials[0].status, 'ready');
    assert.equal(readyText.extractions[0].artifactRef, manifest.extractionArtifact.id);
    assert.ok((await db.creationStorageObject.findUniqueOrThrow({ where: { id: manifest.extractionArtifact.id } })).referencedAt);
    const replacedIntent = applyCommand(readyText, { type: 'request_recommendations', requestId: randomUUID(), query: 'Learn shaders instead' });
    assert.ok(await repo.enqueue(owner, readyText, replacedIntent));
    assert.equal((await db.creationStorageObject.findUniqueOrThrow({ where: { id: sourceRef.id } })).referencedAt, null);
    assert.ok(await repo.cancel(owner, replacedIntent, applyCommand(replacedIntent, { type: 'cancel_recommendations' })));
    stage = 'retention protection and tombstones';
    const retention = createCreationRetentionRepository(db);
    const old = new Date(Date.now() - 61 * 86400_000);
    const scopes: Record<string, string> = {};
    for (const name of ['orphan', 'published', 'reading', 'uploading', 'busy']) {
      const id = randomUUID();
      scopes[name] = id;
      await db.creationDraft.create({ data: { id, ownerId: owner, snapshot: initialSnapshot(id), updatedAt: old } });
      if (name === 'busy') {
        await db.creationJob.create({ data: { draftId: id, ownerId: owner, kind: 'recommendations',
          requestId: randomUUID(), inputRevision: 1, inputFingerprint: randomUUID(), input: {} } });
      } else {
        await db.creationStorageObject.create({ data: { id: randomUUID(), blobId: randomUUID(), draftId: id,
          ownerId: owner, kind: 'artifact', status: name === 'uploading' ? 'uploading' : 'ready',
          mediaType: 'application/json', reservedBytes: 1, referencedAt: old,
          createdAt: name === 'uploading' ? new Date() : old,
          publishedAt: name === 'published' ? old : null,
          readLeaseUntil: name === 'reading' ? new Date(Date.now() + 300_000) : null } });
      }
    }
    assert.equal(await retention.expireInactive(new Date(), 50), 1, 'only unprotected inactive draft expires');
    const expired = await db.creationDraft.findUniqueOrThrow({ where: { id: scopes.orphan } });
    assert.ok(expired.expiredAt);
    assert.equal(await repo.enqueue(owner, initialSnapshot(scopes.orphan), applyCommand(initialSnapshot(scopes.orphan), {
      type: 'request_recommendations', query: 'Learn rendering', requestId: randomUUID(),
    })), null, 'expired drafts cannot enqueue');
    assert.equal((await db.creationStorageObject.findFirstOrThrow({ where: { draftId: scopes.orphan } })).referencedAt, null);
    assert.equal(await retention.finalizeExpired(50), 0, 'SQL waits for blob metadata cleanup');
    const metadata = createCreationStorageMetadata(db);
    const stored = await db.creationStorageObject.findFirstOrThrow({ where: { draftId: scopes.orphan } });
    const expiredScope = { ownerId: owner, draftId: scopes.orphan };
    assert.equal(await metadata.find(expiredScope, stored.id), null, 'expired bytes are unreadable');
    await assert.rejects(metadata.pin(expiredScope, stored.id, true), { code: 'NOT_FOUND' });
    await assert.rejects(metadata.protectRead(expiredScope, stored.id, new Date(Date.now() + 90_000)), { code: 'NOT_FOUND' });
    await assert.rejects(metadata.complete(expiredScope, stored.id, 1, 'checksum'), { code: 'NOT_FOUND' });
    const deletion = randomUUID();
    assert.ok(await metadata.claimDeletion(expiredScope, stored.id, deletion, new Date(Date.now() - 7 * 86400_000)));
    assert.equal(await metadata.finishDeletion(expiredScope, stored.id, randomUUID()), false, 'stale deletion token');
    assert.equal(await retention.finalizeExpired(50), 0, 'blob failure remains recoverable');
    // Simulate successful byte deletion before acknowledging metadata deletion.
    assert.equal(await metadata.finishDeletion(expiredScope, stored.id, deletion), true);
    assert.equal(await retention.finalizeExpired(50), 1);
    assert.equal(await db.creationDraft.findUnique({ where: { id: scopes.orphan } }), null);
    await db.creationEvent.updateMany({ data: { createdAt: old } });
    await db.creationBudget.create({ data: { key: 'expired-test-counter', used: 1, expiresAt: old } });
    const pruned = await retention.prune(new Date(), 1000);
    assert.ok(pruned.events > 0);
    assert.ok(pruned.budgets > 0);
    assert.equal(await db.creationBudget.count({ where: { key: { startsWith: 'active-model-slot:' } } }), 2,
      'model slot fencing survives retention');
  } finally {
    await Promise.allSettled([db.$disconnect(), pool.end(), defaultPrisma.$disconnect()]);
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await admin.end(); }
  }
  console.log('SQL smoke passed: ownership, CAS, recommendation/text jobs, artifact pinning, restart, reload, retention; isolated schema removed.');
}

main().catch(error => {
  // Connection errors can contain credential-bearing URLs; keep terminal output safe.
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,20}$/.test(error.code) ? error.code : 'unavailable';
  const databaseCode = typeof error?.meta?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.meta.code) ? ` (${error.meta.code})` : '';
  const reason = error instanceof AssertionError ? error.message : `error code ${code}${databaseCode}`;
  console.error(`Creation SQL smoke failed at ${stage}: ${reason}. Existing application schema was not migrated.`);
  process.exitCode = 1;
});
