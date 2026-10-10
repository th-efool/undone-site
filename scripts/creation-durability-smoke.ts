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
import { createCreationDraftRepository } from '../src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import { retainedWebCheckpointSchema, webMaterialManifestSchema } from '../src/shared/cohort-creation/web';
import { WEB_PARSER_VERSION, webExtractionVersion, webExtractionFingerprint, webReceiptFingerprint } from '../src/server/domain/cohort-creation/materials/web-identity';
import { PDF_PARSER_VERSION, pdfExtractionVersion, pdfAcquisitionFingerprint } from '../src/server/domain/cohort-creation/materials/pdf-identity';
import { materialManifestSchema } from '../src/shared/cohort-creation/materials';
import { retainedYoutubeMetadataSchema, YOUTUBE_METADATA_VERSION, youtubeObservationCheckpointSchema, youtubeMaterialManifestSchema } from '../src/shared/cohort-creation/youtube';
import { youtubeMaterialVersion, YOUTUBE_BUNDLE_VERSION } from '../src/server/domain/cohort-creation/materials/youtube-identity';
import { JobBudgetExceeded } from '../src/server/domain/cohort-creation/durable-job';
import { githubSelectionSchema, retainedGithubCheckpointSchema, githubMaterialManifestSchema, GITHUB_PARSER_VERSION } from '../src/shared/cohort-creation/github';
import { githubExtractionVersion, githubReceiptFingerprint, githubUnitId } from '../src/server/domain/cohort-creation/materials/github-extraction';
import { youtubeMetadataFingerprint } from '../src/server/domain/cohort-creation/materials/youtube-artifacts';
import { notionMaterialManifestSchema, retainedNotionCheckpointSchema, NOTION_PARSER_VERSION } from '../src/shared/cohort-creation/notion';
import { notionExtractionVersion, notionReceiptFingerprint, notionUnitId } from '../src/server/domain/cohort-creation/materials/notion-extraction';
import { discoveryResultSchema } from '../src/shared/cohort-creation/discovery';
import { discoveryFingerprint } from '../src/server/domain/cohort-creation/discovery.service';

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
    stage = 'web receipt checkpoints, restart and owner pins';
    const drafts = createCreationDraftRepository(db);
    const webDraftId = randomUUID();
    const webOwn = creationSnapshotSchema.parse({ ...readyText, draftId: webDraftId, revision: 0,
      materials: [], extractions: [], materialRefs: [] });
    await db.creationDraft.create({ data: { id: webDraftId, ownerId: owner, snapshot: webOwn } });
    const webCommand = { type: 'acquire_web' as const, requestId: randomUUID(), materialId: randomUUID(), url: 'https://docs.example.com/article' };
    const webQueued = applyCommand(webOwn, webCommand);
    assert.ok(await repo.enqueue(owner, webOwn, webQueued));
    assert.ok(await repo.enqueue(owner, webOwn, webQueued), 'duplicate URL enqueue replays');
    const webJob = await repo.claim('web-first'); assert.ok(webJob?.kind === 'acquire_web');
    const rawWeb = { id: randomUUID(), kind: 'upload' as const, byteLength: 100, checksum: 'a'.repeat(64) };
    const receiptRef = { id: randomUUID(), kind: 'artifact' as const, byteLength: 500, checksum: 'b'.repeat(64) };
    const extractionRef = { id: randomUUID(), kind: 'artifact' as const, byteLength: 1000, checksum: 'c'.repeat(64) };
    const receipt = { schemaVersion: 1 as const, materialId: webCommand.materialId, inputRevision: webQueued.inputRevision,
      requestedUrl: webCommand.url, finalUrl: webCommand.url, redirects: [], mediaType: 'text/html' as const,
      retainedSource: rawWeb, fetchedAt: new Date().toISOString(), fetchVersion: 'public-https-pinned-v1' as const };
    const retained = retainedWebCheckpointSchema.parse({ phase: 'retained_web', receipt, receiptArtifact: receiptRef,
      receiptFingerprint: webReceiptFingerprint(receipt) });
    const webManifest = webMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision: webQueued.inputRevision,
      source: { ...webQueued.materials[0], status: 'ready', selectedUnitIds: [webCommand.materialId] },
      retainedSource: rawWeb, extractionArtifact: extractionRef,
      extraction: { materialId: webCommand.materialId, version: webExtractionVersion(rawWeb.checksum), checksum: rawWeb.checksum,
        artifactRef: extractionRef.id, extractionKind: 'text', segmentCount: 2, complete: true, selectionScope: 'main_article' },
      parserVersion: WEB_PARSER_VERSION, inputFingerprint: webExtractionFingerprint(receipt), acquiredAt: new Date().toISOString(),
      receipt, receiptArtifact: receiptRef, receiptFingerprint: retained.receiptFingerprint });
    for (const ref of [rawWeb, receiptRef, extractionRef]) await db.creationStorageObject.create({ data: {
      ...ref, blobId: randomUUID(), draftId: webDraftId, ownerId: ref.id === receiptRef.id ? 'foreign-owner' : owner,
      status: 'ready', mediaType: ref.kind === 'upload' ? 'text/html' : 'application/json', reservedBytes: ref.byteLength,
      artifactType: ref.id === receiptRef.id ? 'web-response' : ref.id === extractionRef.id ? 'web-extraction' : null,
      schemaVersion: ref.kind === 'artifact' ? 1 : null,
      inputFingerprint: ref.id === receiptRef.id ? retained.receiptFingerprint : ref.id === extractionRef.id ? webManifest.inputFingerprint : null,
    } });
    await assert.rejects(repo.checkpoint(webJob, retained), /Checkpoint storage reference unavailable/);
    assert.equal((await db.creationStorageObject.findUniqueOrThrow({ where: { id: rawWeb.id } })).referencedAt, null, 'foreign receipt rolls back raw pin');
    await db.creationStorageObject.update({ where: { id: receiptRef.id }, data: { ownerId: owner } });
    assert.equal(await repo.checkpoint(webJob, retained), true);
    const retainedState = await drafts.load(owner, webDraftId); assert.ok(retainedState);
    assert.equal(retainedState.materials[0].status, 'acquiring'); assert.equal(retainedState.materialRefs[0].ids.length, 2);
    await db.creationJob.update({ where: { id: webJob.id }, data: { leaseUntil: new Date(0) } });
    const resumedWeb = await repo.claim('web-restart'); assert.ok(resumedWeb?.kind === 'acquire_web' && resumedWeb.checkpoint && 'phase' in resumedWeb.checkpoint);
    assert.equal(await repo.checkpoint(webJob, retained), false, 'old web lease cannot overwrite retained checkpoint');
    await executeCreationJob(repo, resumedWeb, () => { throw new Error('No AI expected'); }, new AbortController().signal, undefined,
      () => ({ acquire: async () => { throw new Error('Retained checkpoint must not refetch'); }, extract: async () => webManifest }));
    const readyWeb = await drafts.load(owner, webDraftId); assert.ok(readyWeb);
    assert.equal(readyWeb.materials[0].status, 'ready'); assert.equal(readyWeb.materialRefs[0].ids.length, 3);
    const removedWeb = applyCommand(readyWeb, { type: 'remove_material', materialId: webCommand.materialId });
    assert.equal(await drafts.swap('other-owner', webDraftId, readyWeb.revision, removedWeb), false);
    assert.equal(await drafts.swap(owner, webDraftId, readyWeb.revision, removedWeb), true);
    assert.equal(await drafts.swap(owner, webDraftId, readyWeb.revision, removedWeb), false, 'stale removal cannot replay');
    assert.equal(await db.creationStorageObject.count({ where: { draftId: webDraftId, referencedAt: { not: null } } }), 0, 'all detached web pins release');
    stage = 'durable PDF ownership, typed uploads and checkpoint recovery';
    const pdfDraftId = randomUUID(); const pdfStart = { ...starting, draftId: pdfDraftId };
    await db.creationDraft.create({ data: { id: pdfDraftId, ownerId: owner, snapshot: pdfStart, revision: pdfStart.revision } });
    const pdfRef = { id: randomUUID(), kind: 'upload' as const, byteLength: 800, checksum: 'd'.repeat(64) };
    await db.creationStorageObject.create({ data: { ...pdfRef, blobId: randomUUID(), draftId: pdfDraftId,
      ownerId: 'foreign-owner', status: 'ready', mediaType: 'application/pdf', reservedBytes: pdfRef.byteLength } });
    const pdfCommand = { type: 'acquire_pdf' as const, requestId: randomUUID(), materialId: randomUUID(), assetId: pdfRef.id };
    const pdfNext = applyCommand(pdfStart, pdfCommand);
    await assert.rejects(repo.enqueue(owner, pdfStart, pdfNext), error => error instanceof CreationFailure && error.detail.code === 'INVALID_REQUEST');
    await db.creationStorageObject.update({ where: { id: pdfRef.id }, data: { ownerId: owner, mediaType: 'text/plain' } });
    await assert.rejects(repo.enqueue(owner, pdfStart, pdfNext), error => error instanceof CreationFailure && error.detail.code === 'INVALID_REQUEST');
    await db.creationStorageObject.update({ where: { id: pdfRef.id }, data: { mediaType: 'application/pdf' } });
    assert.ok(await repo.enqueue(owner, pdfStart, pdfNext)); assert.ok(await repo.enqueue(owner, pdfStart, pdfNext));
    assert.equal(await db.creationJob.count({ where: { draftId: pdfDraftId } }), 1, 'duplicate PDF enqueue reuses job');
    const pdfJob = await repo.claim('pdf-worker'); assert.ok(pdfJob?.kind === 'acquire_pdf');
    pdfJob.deadlineAt = new Date(Date.now() + 300_000);
    await db.creationJob.update({ where: { id: pdfJob.id }, data: { deadlineAt: pdfJob.deadlineAt, leaseUntil: new Date(Date.now() + 300_000) } });
    const pdfArtifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 1500, checksum: 'e'.repeat(64) };
    const pdfManifest = materialManifestSchema.parse({ schemaVersion: 1, inputRevision: pdfJob.inputRevision,
      source: { ...pdfJob.input.source, selectedUnitIds: [pdfCommand.materialId], status: 'ready' }, retainedSource: pdfRef,
      extractionArtifact: pdfArtifact, parserVersion: PDF_PARSER_VERSION, inputFingerprint: pdfAcquisitionFingerprint(pdfCommand.materialId, pdfJob.inputRevision, pdfRef),
      acquiredAt: new Date().toISOString(), extraction: { materialId: pdfCommand.materialId, version: pdfExtractionVersion(pdfRef.checksum),
        checksum: pdfRef.checksum, artifactRef: pdfArtifact.id, extractionKind: 'text', segmentCount: 2, complete: true } });
    await db.creationStorageObject.create({ data: { ...pdfArtifact, blobId: randomUUID(), draftId: pdfDraftId,
      ownerId: owner, status: 'ready', mediaType: 'application/json', reservedBytes: pdfArtifact.byteLength,
      artifactType: 'text-extraction', schemaVersion: 1, inputFingerprint: pdfManifest.inputFingerprint } });
    await assert.rejects(repo.checkpoint(pdfJob, pdfManifest), /Checkpoint storage reference unavailable/);
    await db.creationStorageObject.update({ where: { id: pdfArtifact.id }, data: { artifactType: 'pdf-extraction' } });
    assert.equal(await repo.checkpoint(pdfJob, pdfManifest), true);
    await db.creationJob.update({ where: { id: pdfJob.id }, data: { leaseUntil: new Date(0) } });
    const resumedPdf = await repo.claim('pdf-restart'); assert.ok(resumedPdf?.kind === 'acquire_pdf' && resumedPdf.checkpoint);
    assert.equal(await repo.checkpoint(pdfJob, pdfManifest), false, 'old PDF lease cannot overwrite checkpoint');
    await executeCreationJob(repo, resumedPdf, () => { throw new Error('No AI expected'); }, new AbortController().signal,
      undefined, undefined, () => ({ acquire: async () => { throw new Error('Complete PDF checkpoint must not parse again'); } }));
    const readyPdf = await drafts.load(owner, pdfDraftId); assert.ok(readyPdf);
    assert.equal(readyPdf.materials[0].status, 'ready'); assert.equal(readyPdf.materialRefs[0].ids.length, 2);
    assert.equal(await drafts.swap(owner, pdfDraftId, readyPdf.revision, applyCommand(readyPdf, { type: 'remove_material', materialId: pdfCommand.materialId })), true);
    assert.equal(await db.creationStorageObject.count({ where: { draftId: pdfDraftId, referencedAt: { not: null } } }), 0);
    stage = 'durable YouTube inspection and preview fencing';
    const ytDraftId = randomUUID(); const ytStart = { ...starting, draftId: ytDraftId };
    await db.creationDraft.create({ data: { id: ytDraftId, ownerId: owner, snapshot: ytStart, revision: ytStart.revision } });
    const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const ytCommand = { type: 'inspect_youtube' as const, requestId: randomUUID(), materialId: randomUUID(), url: ytUrl };
    const ytNext = applyCommand(ytStart, ytCommand);
    assert.ok(await repo.enqueue(owner, ytStart, ytNext)); assert.ok(await repo.enqueue(owner, ytStart, ytNext));
    assert.equal(await db.creationJob.count({ where: { draftId: ytDraftId } }), 1);
    const ytJob = await repo.claim('youtube-inspector'); assert.ok(ytJob?.kind === 'inspect_youtube');
    ytJob.deadlineAt = new Date(Date.now() + 300_000);
    await db.creationJob.update({ where: { id: ytJob.id }, data: { deadlineAt: ytJob.deadlineAt, leaseUntil: new Date(Date.now() + 300_000) } });
    const ytArtifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 1500, checksum: 'f'.repeat(64) };
    const ytRetained = retainedYoutubeMetadataSchema.parse({ receipt: { schemaVersion: 1, materialId: ytCommand.materialId,
      inputRevision: ytJob.inputRevision, parserVersion: YOUTUBE_METADATA_VERSION, metadata: { schemaVersion: 1, kind: 'youtube_video', playlistId: null,
        sourceUrl: ytUrl, fetchedAt: new Date().toISOString(), coverage: 'complete_metadata', units: [{ videoId: 'dQw4w9WgXcQ', url: ytUrl,
          title: 'Real fixture lighting lesson', description: 'Metadata is not extracted video content', channelId: 'channel', channelTitle: 'Teacher',
          publishedAt: '2026-01-01T00:00:00Z', etag: 'etag', privacy: 'public', durationSeconds: 120 }] } },
      artifact: ytArtifact, inputFingerprint: youtubeMetadataFingerprint(ytCommand.materialId, ytJob.inputRevision, ytUrl) });
    await db.creationStorageObject.create({ data: { ...ytArtifact, blobId: randomUUID(), ownerId: 'foreign-owner', draftId: ytDraftId,
      status: 'ready', mediaType: 'application/json', reservedBytes: ytArtifact.byteLength, artifactType: 'youtube-metadata', schemaVersion: 1, inputFingerprint: ytRetained.inputFingerprint } });
    await assert.rejects(repo.checkpoint(ytJob, ytRetained), /Checkpoint storage reference unavailable/);
    await db.creationStorageObject.update({ where: { id: ytArtifact.id }, data: { ownerId: owner } });
    assert.equal(await repo.checkpoint(ytJob, ytRetained), true);
    await db.creationJob.update({ where: { id: ytJob.id }, data: { leaseUntil: new Date(0) } });
    const ytResumed = await repo.claim('youtube-restart'); assert.ok(ytResumed?.kind === 'inspect_youtube' && ytResumed.checkpoint);
    assert.equal(await repo.checkpoint(ytJob, ytRetained), false);
    await executeCreationJob(repo, ytResumed, () => { throw new Error('No AI expected'); }, new AbortController().signal,
      undefined, undefined, undefined, () => ({ retainMetadata: async () => { throw new Error('Complete receipt must not refetch'); } }));
    const ytReady = await drafts.load(owner, ytDraftId); assert.ok(ytReady);
    assert.equal(ytReady.materials[0].status, 'needs_input'); assert.equal(ytReady.extractions.length, 0);
    assert.equal(ytReady.youtubeSources[0].units[0].title, 'Real fixture lighting lesson');
    assert.equal(ytReady.materialRefs[0].ids[0], ytArtifact.id);
    stage = 'durable selected-video observations, budgets and recovery';
    const ytSelected = applyCommand(ytReady, { type: 'select_youtube_units', materialId: ytCommand.materialId, unitIds: ['dQw4w9WgXcQ'] });
    assert.equal(await drafts.swap(owner, ytDraftId, ytReady.revision, ytSelected), true);
    const observeCommand = { type: 'observe_youtube' as const, materialId: ytCommand.materialId, requestId: randomUUID() };
    const observeNext = applyCommand(ytSelected, observeCommand);
    assert.ok(await repo.enqueue(owner, ytSelected, observeNext)); assert.ok(await repo.enqueue(owner, ytSelected, observeNext));
    assert.equal(await db.creationJob.count({ where: { draftId: ytDraftId, kind: 'observe_youtube' } }), 1);
    const observeJob = await repo.claim('video-observer'); assert.ok(observeJob?.kind === 'observe_youtube');
    assert.ok(observeJob.deadlineAt.getTime() > Date.now() + 5 * 3600_000);
    assert.equal(observeJob.input.metadata.sourceRevision, ytJob.inputRevision, 'selection does not rewrite source revision');
    await db.creationJob.update({ where: { id: observeJob.id }, data: { leaseUntil: new Date(Date.now() + 300_000) } });
    await assert.rejects(repo.reserveModelCall(observeJob, 'AAAAAAAAAAA'), /selected video/);
    const releaseVideo = await repo.reserveModelCall(observeJob, 'dQw4w9WgXcQ'); assert.equal(typeof releaseVideo, 'function');
    const activeVideoSlot = await db.creationBudget.findFirstOrThrow({ where: { key: { startsWith: 'active-model-slot:' }, expiresAt: { gt: new Date() } } });
    assert.ok(activeVideoSlot.expiresAt.getTime() > Date.now() + 60_000, 'video slot outlives the 90-second model deadline');
    if (releaseVideo) await releaseVideo();
    const releaseRepair = await repo.reserveModelCall(observeJob, 'dQw4w9WgXcQ'); if (releaseRepair) await releaseRepair();
    await assert.rejects(repo.reserveModelCall(observeJob, 'dQw4w9WgXcQ'), JobBudgetExceeded);
    const unitArtifact = { id: randomUUID(), kind: 'artifact' as const, byteLength: 1200, checksum: 'b'.repeat(64) };
    const unitVersion = 'c'.repeat(64);
    const observationCheckpoint = youtubeObservationCheckpointSchema.parse({ phase: 'youtube_observations', materialId: ytCommand.materialId,
      inputRevision: observeJob.inputRevision, sourceRevision: ytJob.inputRevision, metadataArtifact: ytArtifact, metadataFingerprint: ytRetained.inputFingerprint,
      units: [{ unitId: 'dQw4w9WgXcQ', artifact: unitArtifact, version: unitVersion, segmentCount: 1, textBytes: 50 }] });
    await db.creationStorageObject.create({ data: { ...unitArtifact, blobId: randomUUID(), ownerId: owner, draftId: ytDraftId,
      status: 'ready', mediaType: 'application/json', reservedBytes: unitArtifact.byteLength, artifactType: 'wrong-type', schemaVersion: 1, inputFingerprint: unitVersion } });
    await assert.rejects(repo.checkpoint(observeJob, observationCheckpoint), /Checkpoint storage reference unavailable/);
    await db.creationStorageObject.update({ where: { id: unitArtifact.id }, data: { artifactType: 'youtube-observation' } });
    assert.equal(await repo.checkpoint(observeJob, observationCheckpoint), true);
    const partial = await drafts.load(owner, ytDraftId); assert.ok(partial);
    assert.equal(partial.youtubeSources[0].observations.length, 1); assert.equal(partial.materialRefs[0].ids.length, 2);
    assert.equal(partial.extractions.length, 0, 'partial observations are never ready content');
    await assert.rejects(repo.checkpoint(observeJob, { ...observationCheckpoint, units: [] }), /saved selection and retained work/);
    await db.creationJob.update({ where: { id: observeJob.id }, data: { leaseUntil: new Date(0) } });
    const observeResumed = await repo.claim('video-observer-restart'); assert.ok(observeResumed?.kind === 'observe_youtube' && observeResumed.checkpoint);
    await db.creationJob.update({ where: { id: observeResumed.id }, data: { leaseUntil: new Date(Date.now() + 300_000) } });
    assert.equal(await repo.checkpoint(observeJob, observationCheckpoint), false, 'stale observer is fenced');
    const bundleVersion = youtubeMaterialVersion(observationCheckpoint);
    const bundle = { id: randomUUID(), kind: 'artifact' as const, byteLength: 900, checksum: 'd'.repeat(64) };
    const observedManifest = youtubeMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision: observeResumed.inputRevision,
      source: { ...observeResumed.input.source, status: 'ready' }, retainedSource: ytArtifact, youtube: observationCheckpoint,
      extraction: { materialId: ytCommand.materialId, version: bundleVersion, checksum: ytArtifact.checksum, artifactRef: bundle.id,
        extractionKind: 'video_observation', selectionScope: 'video_observation', complete: false, segmentCount: 1 },
      extractionArtifact: bundle, parserVersion: YOUTUBE_BUNDLE_VERSION, inputFingerprint: bundleVersion, acquiredAt: new Date().toISOString() });
    await db.creationStorageObject.create({ data: { ...bundle, blobId: randomUUID(), ownerId: owner, draftId: ytDraftId,
      status: 'ready', mediaType: 'application/json', reservedBytes: bundle.byteLength, artifactType: 'youtube-material', schemaVersion: 1, inputFingerprint: bundleVersion } });
    assert.equal(await repo.checkpoint(observeResumed, observedManifest), true);
    await db.creationJob.update({ where: { id: observeResumed.id }, data: { leaseUntil: new Date(0), deadlineAt: new Date(0) } });
    const finishedObservation = await repo.claim('video-finalizer'); assert.ok(finishedObservation?.kind === 'observe_youtube');
    await executeCreationJob(repo, finishedObservation, () => { throw new Error('No recommendation call'); }, new AbortController().signal,
      undefined, undefined, undefined, undefined, () => ({ acquire: async () => { throw new Error('Complete bundle must not repay model work'); } }));
    const observedReady = await drafts.load(owner, ytDraftId); assert.ok(observedReady);
    assert.equal(observedReady.materials[0].status, 'ready'); assert.equal(observedReady.extractions[0].complete, false);
    assert.equal(observedReady.materialRefs[0].ids.length, 3);
    const clearedVideos = applyCommand(observedReady, { type: 'select_youtube_units', materialId: ytCommand.materialId, unitIds: [] });
    assert.equal(await drafts.swap(owner, ytDraftId, observedReady.revision, clearedVideos), true);
    assert.equal(await db.creationStorageObject.count({ where: { draftId: ytDraftId, referencedAt: { not: null } } }), 1, 'only metadata remains pinned after deselection');
    assert.equal(await drafts.swap(owner, ytDraftId, clearedVideos.revision, applyCommand(clearedVideos, { type: 'remove_material', materialId: ytCommand.materialId })), true);
    assert.equal((await db.creationStorageObject.findUniqueOrThrow({ where: { id: ytArtifact.id } })).referencedAt, null);
    stage = 'durable GitHub content, unit capacity and receipt recovery';
    const ghDraftId = randomUUID(); const ghStart = creationSnapshotSchema.parse({ ...starting, draftId: ghDraftId,
      materials: [{ id: randomUUID(), kind: 'markdown', input: { kind: 'upload', assetId: randomUUID() }, status: 'pending',
        selectedUnitIds: Array.from({ length: 99 }, (_, index) => `fixture-unit-${index}`) }] });
    await db.creationDraft.create({ data: { id: ghDraftId, ownerId: owner, snapshot: ghStart, revision: ghStart.revision } });
    const ghSelection = githubSelectionSchema.parse({ url: 'https://github.com/Example/Lessons', paths: ['README.md'] });
    const ghCommand = { type: 'acquire_github' as const, materialId: randomUUID(), requestId: randomUUID(), selection: ghSelection };
    const ghNext = applyCommand(ghStart, ghCommand);
    assert.ok(await repo.enqueue(owner, ghStart, ghNext)); assert.ok(await repo.enqueue(owner, ghStart, ghNext));
    assert.equal(await db.creationJob.count({ where: { draftId: ghDraftId } }), 1);
    const ghJob = await repo.claim('github-acquirer'); assert.ok(ghJob?.kind === 'acquire_github');
    assert.equal(ghJob.input.maxUnits, 1); assert.ok(ghJob.deadlineAt.getTime() > Date.now() + 300_000);
    await db.creationJob.update({ where: { id: ghJob.id }, data: { leaseUntil: new Date(Date.now() + 300_000) } });
    await assert.rejects(repo.reserveModelCall(ghJob), /selected video/);
    const ghRaw = { id: randomUUID(), kind: 'artifact' as const, byteLength: 1500, checksum: 'e'.repeat(64) };
    const ghRetained = retainedGithubCheckpointSchema.parse({ phase: 'retained_github', materialId: ghCommand.materialId,
      inputRevision: ghJob.inputRevision, selection: ghSelection, commit: 'f'.repeat(40), files: [{ path: 'README.md', blobSha: 'a'.repeat(40), byteLength: 100 }],
      artifact: ghRaw, inputFingerprint: githubReceiptFingerprint(ghCommand.materialId, ghJob.inputRevision, ghSelection) });
    await db.creationStorageObject.create({ data: { ...ghRaw, blobId: randomUUID(), ownerId: 'foreign-owner', draftId: ghDraftId,
      status: 'ready', mediaType: 'application/json', reservedBytes: ghRaw.byteLength, artifactType: 'github-source', schemaVersion: 1, inputFingerprint: ghRetained.inputFingerprint } });
    await assert.rejects(repo.checkpoint(ghJob, ghRetained), /Checkpoint storage reference unavailable/);
    await db.creationStorageObject.update({ where: { id: ghRaw.id }, data: { ownerId: owner } });
    assert.equal(await repo.checkpoint(ghJob, ghRetained), true);
    const ghPartial = await drafts.load(owner, ghDraftId); assert.ok(ghPartial);
    assert.equal(ghPartial.materialRefs[0].ids[0], ghRaw.id); assert.equal(ghPartial.extractions.length, 0);
    await db.creationJob.update({ where: { id: ghJob.id }, data: { leaseUntil: new Date(0) } });
    const ghResumed = await repo.claim('github-restart'); assert.ok(ghResumed?.kind === 'acquire_github' && ghResumed.checkpoint);
    await db.creationJob.update({ where: { id: ghResumed.id }, data: { leaseUntil: new Date(Date.now() + 300_000) } });
    assert.equal(await repo.checkpoint(ghJob, ghRetained), false, 'old GitHub worker is fenced');
    const ghVersion = githubExtractionVersion(ghRaw.checksum);
    const ghExtracted = { id: randomUUID(), kind: 'artifact' as const, byteLength: 2000, checksum: 'b'.repeat(64) };
    const ghManifest = githubMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision: ghResumed.inputRevision,
      source: { ...ghResumed.input.source, status: 'ready', selectedUnitIds: [githubUnitId(ghRetained.commit, 'README.md')] },
      retainedSource: ghRaw, github: ghRetained, extraction: { materialId: ghCommand.materialId, version: ghVersion, checksum: ghRaw.checksum,
        artifactRef: ghExtracted.id, extractionKind: 'text', selectionScope: 'selected_paths', complete: true, segmentCount: 1 },
      extractionArtifact: ghExtracted, parserVersion: GITHUB_PARSER_VERSION, inputFingerprint: ghVersion, acquiredAt: new Date().toISOString() });
    await db.creationStorageObject.create({ data: { ...ghExtracted, blobId: randomUUID(), ownerId: owner, draftId: ghDraftId,
      status: 'ready', mediaType: 'application/json', reservedBytes: ghExtracted.byteLength, artifactType: 'github-extraction', schemaVersion: 1, inputFingerprint: ghVersion } });
    await executeCreationJob(repo, ghResumed, () => { throw new Error('No AI expected'); }, new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, () => ({ acquire: async () => { throw new Error('Retained receipt must not refetch moved branch'); },
        extract: async () => ghManifest }));
    const ghReady = await drafts.load(owner, ghDraftId); assert.ok(ghReady);
    assert.equal(ghReady.materials[1].status, 'ready'); assert.equal(ghReady.materialRefs[0].ids.length, 2);
    assert.equal(ghReady.extractions[0].selectionScope, 'selected_paths');
    assert.equal(ghReady.materials.reduce((sum, source) => sum + source.selectedUnitIds.length, 0), 100);
    assert.equal(await drafts.swap(owner, ghDraftId, ghReady.revision, applyCommand(ghReady, { type: 'remove_material', materialId: ghCommand.materialId })), true);
    assert.equal(await db.creationStorageObject.count({ where: { draftId: ghDraftId, referencedAt: { not: null } } }), 0);
    stage = 'durable Notion receipt, provider backoff and fenced restart';
    const ntDraftId = randomUUID(); const ntStart = creationSnapshotSchema.parse({ ...starting, draftId: ntDraftId });
    await db.creationDraft.create({ data: { id: ntDraftId, ownerId: owner, snapshot: ntStart, revision: ntStart.revision } });
    const ntPage = randomUUID(); const ntCommand = { type: 'acquire_notion' as const, materialId: randomUUID(), requestId: randomUUID(),
      url: `https://www.notion.so/${ntPage.replaceAll('-', '')}` };
    const ntNext = applyCommand(ntStart, ntCommand);
    assert.ok(await repo.enqueue(owner, ntStart, ntNext)); assert.ok(await repo.enqueue(owner, ntStart, ntNext));
    assert.equal(await db.creationJob.count({ where: { draftId: ntDraftId } }), 1);
    assert.equal(await repo.enqueue('foreign-owner', ntStart, ntNext), null);
    const ntJob = await repo.claim('notion-acquirer'); assert.ok(ntJob?.kind === 'acquire_notion');
    assert.equal(ntJob.input.maxUnits, 100); assert.ok(ntJob.deadlineAt.getTime() > Date.now() + 300_000);
    // Extend only fixture deadlines/leases to exclude remote SQL inspection latency.
    const ntDeadline = new Date(Date.now() + 900_000); ntJob.deadlineAt = ntDeadline;
    await db.creationJob.update({ where: { id: ntJob.id }, data: { deadlineAt: ntDeadline, leaseUntil: new Date(Date.now() + 600_000) } });
    const ntRetryAt = Date.now() + 90_000;
    assert.equal(await repo.retry(ntJob, 90_000), true);
    const ntScheduled = await db.creationJob.findUniqueOrThrow({ where: { id: ntJob.id } });
    assert.ok(ntScheduled.nextRunAt.getTime() >= ntRetryAt); assert.equal(ntScheduled.leaseToken, null);
    assert.equal(await repo.claim('notion-too-early'), null, 'provider minimum delay survives database reload');
    await db.creationJob.update({ where: { id: ntJob.id }, data: { nextRunAt: new Date(0) } });
    const ntRetry = await repo.claim('notion-retry'); assert.ok(ntRetry?.kind === 'acquire_notion');
    await db.creationJob.update({ where: { id: ntRetry.id }, data: { leaseUntil: new Date(Date.now() + 600_000) } });
    const ntRaw = { id: randomUUID(), kind: 'artifact' as const, byteLength: 1500, checksum: 'f'.repeat(64) };
    const ntRetained = retainedNotionCheckpointSchema.parse({ phase: 'retained_notion', materialId: ntCommand.materialId,
      inputRevision: ntRetry.inputRevision, pageId: ntPage, pageEditedAt: new Date().toISOString(), unitId: notionUnitId(ntPage), blockCount: 2, textBytes: 200,
      artifact: ntRaw, inputFingerprint: notionReceiptFingerprint(ntCommand.materialId, ntRetry.inputRevision, ntPage) });
    await db.creationStorageObject.create({ data: { ...ntRaw, blobId: randomUUID(), ownerId: 'foreign-owner', draftId: ntDraftId,
      status: 'ready', mediaType: 'application/json', reservedBytes: ntRaw.byteLength, artifactType: 'notion-source', schemaVersion: 1, inputFingerprint: ntRetained.inputFingerprint } });
    await assert.rejects(repo.checkpoint(ntRetry, ntRetained), /Checkpoint storage reference unavailable/);
    await db.creationStorageObject.update({ where: { id: ntRaw.id }, data: { ownerId: owner, artifactType: 'wrong-type' } });
    await assert.rejects(repo.checkpoint(ntRetry, ntRetained), /Checkpoint storage reference unavailable/);
    await db.creationStorageObject.update({ where: { id: ntRaw.id }, data: { artifactType: 'notion-source' } });
    assert.equal(await repo.checkpoint(ntRetry, ntRetained), true);
    const ntPartial = await drafts.load(owner, ntDraftId); assert.ok(ntPartial);
    assert.equal(ntPartial.materialRefs[0].ids[0], ntRaw.id); assert.equal(ntPartial.extractions.length, 0);
    await db.creationJob.update({ where: { id: ntRetry.id }, data: { leaseUntil: new Date(0) } });
    const ntResumed = await repo.claim('notion-restart'); assert.ok(ntResumed?.kind === 'acquire_notion' && ntResumed.checkpoint);
    await db.creationJob.update({ where: { id: ntResumed.id }, data: { leaseUntil: new Date(Date.now() + 600_000) } });
    assert.equal(await repo.checkpoint(ntRetry, ntRetained), false, 'old Notion lease is fenced');
    const ntVersion = notionExtractionVersion(ntRaw.checksum);
    const ntExtracted = { id: randomUUID(), kind: 'artifact' as const, byteLength: 2000, checksum: 'b'.repeat(64) };
    const ntManifest = notionMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision: ntResumed.inputRevision,
      source: { ...ntResumed.input.source, status: 'ready', selectedUnitIds: [ntRetained.unitId] }, retainedSource: ntRaw, notion: ntRetained,
      extraction: { materialId: ntCommand.materialId, version: ntVersion, checksum: ntRaw.checksum, artifactRef: ntExtracted.id,
        extractionKind: 'text', selectionScope: 'supported_page_text', complete: true, segmentCount: 1 },
      extractionArtifact: ntExtracted, parserVersion: NOTION_PARSER_VERSION, inputFingerprint: ntVersion, acquiredAt: new Date().toISOString() });
    await db.creationStorageObject.create({ data: { ...ntExtracted, blobId: randomUUID(), ownerId: owner, draftId: ntDraftId,
      status: 'ready', mediaType: 'application/json', reservedBytes: ntExtracted.byteLength, artifactType: 'notion-extraction', schemaVersion: 1, inputFingerprint: ntVersion } });
    assert.equal(await repo.checkpoint(ntResumed, ntManifest), true);
    await assert.rejects(repo.checkpoint(ntResumed, ntRetained), /Cannot replace a retained Notion receipt or completed checkpoint/);
    await executeCreationJob(repo, { ...ntResumed, checkpoint: ntManifest }, () => { throw new Error('No AI expected'); }, new AbortController().signal);
    const ntReady = await drafts.load(owner, ntDraftId); assert.ok(ntReady);
    assert.equal(ntReady.materials[0].status, 'ready'); assert.equal(ntReady.extractions[0].selectionScope, 'supported_page_text');
    assert.equal(ntReady.materialRefs[0].ids.length, 2);
    assert.equal(await drafts.swap(owner, ntDraftId, ntReady.revision, applyCommand(ntReady, { type: 'remove_material', materialId: ntCommand.materialId })), true);
    assert.equal(await db.creationStorageObject.count({ where: { draftId: ntDraftId, referencedAt: { not: null } } }), 0);
    stage = 'durable grounded discovery budgets and fenced evidence recovery';
    const dcDraftId = randomUUID(); const dcStart = creationSnapshotSchema.parse({ ...starting, draftId: dcDraftId, startingPoint: 'find_material' });
    await db.creationDraft.create({ data: { id: dcDraftId, ownerId: owner, snapshot: dcStart, revision: dcStart.revision } });
    const dcCommand = { type: 'discover_material' as const, requestId: randomUUID() }; const dcNext = applyCommand(dcStart, dcCommand);
    assert.ok(await repo.enqueue(owner, dcStart, dcNext)); assert.ok(await repo.enqueue(owner, dcStart, dcNext));
    assert.equal(await db.creationJob.count({ where: { draftId: dcDraftId } }), 1);
    assert.equal(await repo.enqueue('foreign-owner', dcStart, dcNext), null);
    const dcJob = await repo.claim('discovery-worker'); assert.ok(dcJob?.kind === 'discover_material');
    assert.ok(dcJob.deadlineAt.getTime() > Date.now() + 800_000);
    await db.creationJob.update({ where: { id: dcJob.id }, data: { leaseUntil: new Date(Date.now() + 600_000) } });
    for (let call = 0; call < 3; call++) { const release = await repo.reserveModelCall(dcJob); assert.ok(release); await release(); }
    await assert.rejects(repo.reserveModelCall(dcJob), JobBudgetExceeded, 'discovery cannot exceed three paid calls');
    const dcFingerprint = discoveryFingerprint(dcJob.input);
    const dcRef = () => ({ id: randomUUID(), kind: 'artifact' as const, byteLength: 1200, checksum: createHash('sha256').update(randomUUID()).digest('hex') });
    const dcSearch = dcRef(); const dcObservation = dcRef(); const dcSelection = dcRef();
    const dcCheckpoint = { phase: 'discovery_sources' as const, requestId: dcJob.requestId, inputRevision: dcJob.inputRevision,
      inputFingerprint: dcFingerprint, searchArtifact: dcSearch, observationArtifact: null, selectionArtifact: null, processed: 0, total: 1 };
    await db.creationStorageObject.create({ data: { ...dcSearch, blobId: randomUUID(), ownerId: 'foreign-owner', draftId: dcDraftId,
      status: 'ready', mediaType: 'application/json', reservedBytes: dcSearch.byteLength, artifactType: 'discovery-search', schemaVersion: 1, inputFingerprint: dcFingerprint } });
    await assert.rejects(repo.checkpoint(dcJob, dcCheckpoint), /Checkpoint storage reference unavailable/);
    await db.creationStorageObject.update({ where: { id: dcSearch.id }, data: { ownerId: owner } });
    assert.equal(await repo.checkpoint(dcJob, dcCheckpoint), true);
    const dcPartial = await drafts.load(owner, dcDraftId); assert.ok(dcPartial);
    assert.equal(dcPartial.discovery?.checkpoint?.searchArtifact.id, dcSearch.id);
    await db.creationJob.update({ where: { id: dcJob.id }, data: { leaseUntil: new Date(0) } });
    const dcResumed = await repo.claim('discovery-restart'); assert.ok(dcResumed?.kind === 'discover_material');
    await db.creationJob.update({ where: { id: dcResumed.id }, data: { leaseUntil: new Date(Date.now() + 600_000) } });
    assert.equal(await repo.checkpoint(dcJob, dcCheckpoint), false, 'old discovery worker is fenced');
    for (const item of [{ ref: dcObservation, type: 'discovery-observations' }, { ref: dcSelection, type: 'discovery-selection' }]) {
      await db.creationStorageObject.create({ data: { ...item.ref, blobId: randomUUID(), ownerId: owner, draftId: dcDraftId,
        status: 'ready', mediaType: 'application/json', reservedBytes: item.ref.byteLength, artifactType: item.type, schemaVersion: 1, inputFingerprint: dcFingerprint } });
    }
    const dcUrl = 'https://www.typescriptlang.org/docs/handbook/intro.html'; const dcKey = createHash('sha256').update(dcUrl).digest('hex');
    const dcResult = discoveryResultSchema.parse({ checkpoint: { ...dcCheckpoint, observationArtifact: dcObservation, selectionArtifact: dcSelection, processed: 1 },
      candidates: [{ key: dcKey, citationIds: ['fixture-citation'], url: dcUrl, title: 'Fixture handbook observation', kind: 'web', observedAt: new Date().toISOString(),
        observation: { method: 'public_http', requestedUrl: dcUrl, redirects: [], titleOrigin: 'observed', contentRetained: false } }],
      failures: [], selection: { selected: [{ candidateKey: dcKey, reason: 'Fixture educational match' }] } });
    await executeCreationJob(repo, dcResumed, () => { throw new Error('No recommendation call'); }, new AbortController().signal,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => ({ run: async (...args) => {
        assert.deepEqual(args[4], dcCheckpoint, 'retained search is passed to resumed discovery'); return dcResult;
      } }));
    const dcReady = await drafts.load(owner, dcDraftId); assert.ok(dcReady);
    assert.equal(dcReady.discovery?.result?.selection.selected[0].candidateKey, dcKey);
    assert.equal(dcReady.materials.length, 0, 'discovery metadata is not imported material');
    assert.equal(await db.creationStorageObject.count({ where: { draftId: dcDraftId, referencedAt: { not: null } } }), 3);
    assert.equal(await drafts.swap(owner, dcDraftId, dcReady.revision, applyCommand(dcReady, { type: 'choose_starting_point', startingPoint: 'have_material' })), true);
    assert.equal(await db.creationStorageObject.count({ where: { draftId: dcDraftId, referencedAt: { not: null } } }), 0, 'abandoned discovery evidence detaches');
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
  console.log('SQL smoke passed: ownership, CAS, recommendation/text/web/PDF/YouTube/GitHub/Notion/discovery, three-call discovery budget, provider backoff, unit capacity, per-video budgets, checkpoint fencing, restart, pin release, reload, retention; isolated schema removed.');
}

main().catch(error => {
  // Connection errors can contain credential-bearing URLs; keep terminal output safe.
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,20}$/.test(error.code) ? error.code : 'unavailable';
  const databaseCode = typeof error?.meta?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.meta.code) ? ` (${error.meta.code})` : '';
  const reason = error instanceof AssertionError ? error.message : `error code ${code}${databaseCode}`;
  console.error(`Creation SQL smoke failed at ${stage}: ${reason}. Existing application schema was not migrated.`);
  process.exitCode = 1;
});
