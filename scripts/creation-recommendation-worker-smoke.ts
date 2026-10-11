/** Opt-in live SQL + Google recommendation worker smoke. Two calls max; no public writes. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { prisma as defaultPrisma } from '../src/server/infrastructure/db/postgres/client';
import { createCreationDraftRepository } from '../src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import { createCreationJobRepository } from '../src/server/infrastructure/db/postgres/repositories/creationJob.repo';
import { creationRecommendationRepo } from '../src/server/infrastructure/db/postgres/repositories/creationRecommendation.repo';
import { DraftConflict, DraftNotFound, DraftService } from '../src/server/domain/cohort-creation/draft.service';
import { RecommendationService } from '../src/server/domain/cohort-creation/recommendation.service';
import { executeCreationJob } from '../src/server/domain/cohort-creation/durable-job.runner';
import { VercelCohortAi } from '../src/server/infrastructure/ai/vercelCohortAi';
import { createCohortModel } from '../src/server/infrastructure/ai/modelRegistry';
import { creationEventEnvelopeSchema } from '../src/shared/cohort-creation/durable';
import { recommendationResultSchema } from '../src/shared/cohort-creation/contracts';

let stage = 'configuration';
let calls = 0;
async function main() {
  assert.ok(process.env.GEMINI_API_KEY && process.env.DATABASE_URL);
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const schema = `creation_smoke_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^creation_smoke_[a-f0-9]{32}$/);
  const admin = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  const pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema} -c timezone=UTC`,
    connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool, { schema }), transactionOptions: { maxWait: 30_000, timeout: 30_000 } });
  let created = false;
  try {
    stage = 'isolated SQL setup';
    await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
    await pool.query('CREATE TABLE "users" ("id" text PRIMARY KEY)');
    for (const file of ['creation-draft.sql', 'creation-durability.sql', 'creation-retention.sql'])
      await pool.query(await readFile(new URL(`../prisma/${file}`, import.meta.url), 'utf8'));
    const owner = randomUUID(); const draftId = randomUUID(); const requestId = randomUUID();
    await pool.query('INSERT INTO "users" ("id") VALUES ($1)', [owner]);
    const drafts = createCreationDraftRepository(db); const jobs = createCreationJobRepository(db);
    const service = new DraftService(drafts, jobs);
    const initial = await service.create(owner, draftId);
    stage = 'durable enqueue and claim';
    await service.command(owner, draftId, initial.revision, { type: 'request_recommendations', requestId, query: 'I want to learn JavaScript functions and closures' });
    const job = await jobs.claim(randomUUID());
    assert.ok(job && job.kind === 'recommendations');
    stage = 'live worker execution';
    await executeCreationJob(jobs, job, claimed => new RecommendationService(new VercelCohortAi(createCohortModel(), {
      maxRetries: 0, beforeCall: async () => {
        assert.ok(calls < 2, 'Live call cap reached'); calls++;
        return jobs.reserveModelCall(claimed);
      },
    }), creationRecommendationRepo), AbortSignal.timeout(90_000));
    stage = 'persisted result and replay envelopes';
    const storedJob = await db.creationJob.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(storedJob.status, 'succeeded');
    const resumed = await service.load(owner, draftId);
    const result = recommendationResultSchema.parse(resumed.result);
    assert.equal(result.requestId, requestId); assert.ok(result.items.length <= 5);
    assert.equal(resumed.stage, 'recommendations');
    const events = await db.creationEvent.findMany({ where: { draftId }, orderBy: { sequence: 'asc' } });
    assert.ok(events.length >= 2);
    events.forEach((event, index) => { assert.equal(event.sequence, index + 1); creationEventEnvelopeSchema.parse(event.envelope); });
    await assert.rejects(service.load(randomUUID(), draftId), DraftNotFound);
    stage = 'reload starting point and stale revision';
    const next = await service.command(owner, draftId, resumed.revision, { type: 'create_own' });
    assert.equal(next.stage, 'starting_point');
    assert.equal((await service.load(owner, draftId)).revision, next.revision);
    await assert.rejects(service.command(owner, draftId, resumed.revision, { type: 'choose_starting_point', startingPoint: 'have_material' }), DraftConflict);
    const replay = await service.command(owner, draftId, initial.revision, { type: 'request_recommendations', requestId, query: initial.query || 'I want to learn JavaScript functions and closures' });
    assert.equal(replay.revision, next.revision);
    assert.equal(await db.creationJob.count({ where: { draftId } }), 1);
    console.log(JSON.stringify({ liveWorker: 'passed', calls, recommendations: result.items.length, events: events.length,
      ownerChecks: 'passed', reload: 'passed', staleRevision: 'passed', duplicateRequest: 'passed' }));
  } finally {
    await Promise.allSettled([db.$disconnect(), pool.end(), defaultPrisma.$disconnect()]);
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await admin.end(); }
  }
  console.log('Disposable schema removed; no public writes, Mongo operations or browser authentication performed.');
}
main().catch(() => { console.error(`Recommendation worker smoke failed at ${stage}; calls=${calls}. Details suppressed.`); process.exitCode = 1; });
