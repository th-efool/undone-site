/** Focused real SQL recovery smoke. Isolated schema + fixture artifact metadata/bodies only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { prisma as defaultPrisma } from '../src/server/infrastructure/db/postgres/client';
import { creationSnapshotSchema } from '../src/shared/cohort-creation/contracts';
import { applyCommand, applyEvent, initialSnapshot } from '../src/shared/cohort-creation/flow';
import { result } from '../src/shared/cohort-creation/__tests__/fixtures';
import { understandingInputFingerprint } from '../src/server/domain/cohort-creation/understanding.service';
import { chunkingInputFingerprint } from '../src/server/domain/cohort-creation/chunking.service';
import { analysisInputFingerprint } from '../src/server/domain/cohort-creation/analysis.service';
import { buildingInputFingerprint } from '../src/server/domain/cohort-creation/building.service';
import { setupPublicationSmokeSchema, runPublicationSmoke } from './creation-publication-smoke';

function readyFixture() {
  const materialId = randomUUID(); const upload = randomUUID(); const extraction = randomUUID();
  const hash = 'a'.repeat(64); const partitionId = 'b'.repeat(64);
  const ref = () => ({ id: randomUUID(), kind: 'artifact' as const, byteLength: 500, checksum: hash });
  const requestId = randomUUID();
  const material = creationSnapshotSchema.parse({ ...initialSnapshot(randomUUID()), result, query: result.intent.rawQuery,
    inputRevision: 1, stage: 'starting_point', startingPoint: 'have_material', status: 'succeeded',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: upload }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: hash, checksum: hash, artifactRef: extraction, extractionKind: 'text', complete: true, segmentCount: 1 }],
    materialRefs: [{ materialId, ids: [extraction] }] });
  const understanding = { phase: 'understanding' as const, requestId, inputRevision: 1, inputFingerprint: understandingInputFingerprint(material, requestId),
    total: 1, partitionIds: [partitionId], completed: [{ partitionId, artifact: ref() }] };
  const understood = applyEvent(applyCommand(material, { type: 'understand_material', requestId }), { type: 'understanding_received', requestId, result: understanding });
  const chunkId = randomUUID();
  const chunking = { ...understanding, phase: 'chunking' as const, requestId: chunkId, inputFingerprint: chunkingInputFingerprint(understood, chunkId),
    understandingFingerprint: understanding.inputFingerprint, completed: [{ partitionId, artifact: ref(), chunkCount: 3 }] };
  const chunked = applyEvent(applyCommand(understood, { type: 'chunk_material', requestId: chunkId }), { type: 'chunking_received', requestId: chunkId, result: chunking });
  const analysisId = randomUUID();
  const analysis = { phase: 'analysis' as const, requestId: analysisId, inputRevision: 1, inputFingerprint: analysisInputFingerprint(chunked, analysisId),
    chunkingFingerprint: chunking.inputFingerprint, total: 1, partitionIds: [partitionId], completed: [{ partitionId, artifact: ref(), chunkCount: 3 }] };
  const analyzed = applyEvent(applyCommand(chunked, { type: 'analyze_material', requestId: analysisId }), { type: 'analysis_received', requestId: analysisId, result: analysis });
  const buildId = randomUUID();
  const building = { phase: 'building' as const, requestId: buildId, inputRevision: 1, inputFingerprint: buildingInputFingerprint(analyzed, buildId),
    analysisFingerprint: analysis.inputFingerprint, total: 1, partitionIds: [partitionId], completed: [{ partitionId, artifact: ref(), lessonCount: 3 }] };
  const ready = applyEvent(applyCommand(analyzed, { type: 'build_curriculum', requestId: buildId }), { type: 'building_received', requestId: buildId, result: building });
  return { ready, upload, refs: [extraction, understanding.completed[0].artifact.id, chunking.completed[0].artifact.id,
    analysis.completed[0].artifact.id, building.completed[0].artifact.id] };
}

let stage = 'connection';
async function main() {
  const connectionString = process.env.CREATION_SMOKE_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  assert.ok(connectionString);
  const schema = `creation_smoke_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^creation_smoke_[a-f0-9]{32}$/);
  const admin = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  const pool = new Pool({ connectionString, max: 5, options: `-c search_path=${schema} -c timezone=UTC`, connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool, { schema }), transactionOptions: { maxWait: 30_000, timeout: 30_000 } });
  let created = false;
  try {
    stage = 'disposable schema';
    await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
    await pool.query('CREATE TABLE "users" ("id" text PRIMARY KEY)');
    for (const file of ['creation-draft.sql', 'creation-durability.sql', 'creation-retention.sql']) await pool.query(await readFile(new URL(`../prisma/${file}`, import.meta.url), 'utf8'));
    await setupPublicationSmokeSchema(pool);
    const owner = randomUUID(); const f = readyFixture();
    await pool.query('INSERT INTO "users" ("id") VALUES ($1)', [owner]);
    await db.creationDraft.create({ data: { id: f.ready.draftId, ownerId: owner, revision: f.ready.revision, snapshot: f.ready } });
    for (const id of [f.upload, ...f.refs]) await db.creationStorageObject.create({ data: { id, ownerId: owner, draftId: f.ready.draftId,
      blobId: randomUUID(), kind: id === f.upload ? 'upload' : 'artifact', status: 'ready', reservedBytes: 500,
      byteLength: 500, checksum: 'a'.repeat(64), mediaType: id === f.upload ? 'text/plain' : 'application/json' } });
    stage = 'publication identity, rollback, recovery and promotion';
    console.log(stage);
    await runPublicationSmoke(db, pool, owner, f.ready);
  } finally {
    await Promise.allSettled([db.$disconnect(), pool.end(), defaultPrisma.$disconnect()]);
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await admin.end(); }
  }
  console.log('Focused publication SQL smoke passed; disposable schema removed. No public migrations, live AI or Mongo writes.');
}
main().catch(() => { console.error(`Focused publication SQL smoke failed at ${stage}; no public schema migration.`); process.exitCode = 1; });
