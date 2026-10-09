/** Opt-in real SQL smoke test. Uses and removes only a newly created isolated schema.
 * No public migrations, model calls, Mongo access, or existing application records.
 */
import assert, { AssertionError } from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { createCreationJobRepository } from '../src/server/infrastructure/db/postgres/repositories/creationJob.repo';
import { prisma as defaultPrisma } from '../src/server/infrastructure/db/postgres/client';
import { applyCommand, initialSnapshot } from '../src/shared/cohort-creation/flow';
import { CreationFailure } from '../src/server/domain/cohort-creation/errors';
import type { RecommendationResult } from '../src/shared/cohort-creation/contracts';

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
    for (const file of ['creation-draft.sql', 'creation-durability.sql']) {
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
  } finally {
    await Promise.allSettled([db.$disconnect(), pool.end(), defaultPrisma.$disconnect()]);
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await admin.end(); }
  }
  console.log('SQL smoke passed: deduplication, ownership, CAS, queue/model limits, fenced releases, restart, checkpoints, reload; isolated schema removed.');
}

main().catch(error => {
  // Connection errors can contain credential-bearing URLs; keep terminal output safe.
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,20}$/.test(error.code) ? error.code : 'unavailable';
  const databaseCode = typeof error?.meta?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.meta.code) ? ` (${error.meta.code})` : '';
  const reason = error instanceof AssertionError ? error.message : `error code ${code}${databaseCode}`;
  console.error(`Creation SQL smoke failed at ${stage}: ${reason}. Existing application schema was not migrated.`);
  process.exitCode = 1;
});
