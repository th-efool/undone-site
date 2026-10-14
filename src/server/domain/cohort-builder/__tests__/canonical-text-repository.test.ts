import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {} }));
import { createPostgresInteractionRepository } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { cohortWorkspaceSchema, planCohortAction } from '@/src/shared/cohort-builder/contracts';
import { claimTextJob } from '../text-jobs';
import { failCurrentTextJob } from '../text-job-failure';

afterEach(() => vi.unstubAllEnvs());
const id = '7d4e49d0-bad0-4aba-a777-122326020001';
const ownerId = 'owner';
const migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');

// A thin Prisma-shaped SQL bridge exercises the production commit method against PGlite.
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE interaction_workspaces (id TEXT PRIMARY KEY, "ownerId" TEXT, "domainId" TEXT,
    "domainVersion" INT DEFAULT 1, snapshot JSONB, revision INT DEFAULT 0, sequence INT DEFAULT 0,
    "contextEpoch" INT DEFAULT 0, lifecycle TEXT DEFAULT 'active', "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE interaction_requests ("workspaceId" TEXT, "actorId" TEXT, operation TEXT, "requestId" TEXT,
    "payloadHash" TEXT, response JSONB, UNIQUE ("workspaceId", "actorId", operation, "requestId"));
    CREATE TABLE interaction_events (id TEXT, "workspaceId" TEXT, sequence INT, payload JSONB,
    "protocolVersion" INT, type TEXT, revision INT, UNIQUE ("workspaceId", sequence));`);
  await db.exec(migration);
  await db.query(`INSERT INTO interaction_workspaces (id, "ownerId", "domainId", snapshot) VALUES ($1,$2,'cohort',$3::jsonb)`,
    [id, ownerId, JSON.stringify(cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Test', intent: 'Learn', audience: '', dailyMinutes: 20, lessons: [] }))]);
  const prisma = { $transaction: async (work: (tx: unknown) => Promise<unknown>) => db.transaction(async tx => work({
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => (await tx.query(strings.reduce((sql, part, index) => sql + (index ? `$${index}` : '') + part, ''), values)).rows,
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => (await tx.query(sql, values)).rows,
    interactionRequest: {
      findUnique: async ({ where }: any) => { const key = where.workspaceId_actorId_operation_requestId;
        return (await tx.query(`SELECT * FROM interaction_requests WHERE "workspaceId"=$1 AND "actorId"=$2 AND operation=$3 AND "requestId"=$4`,
          [key.workspaceId, key.actorId, key.operation, key.requestId])).rows[0] ?? null; },
      create: async ({ data }: any) => tx.query(`INSERT INTO interaction_requests VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [data.workspaceId, data.actorId, data.operation, data.requestId, data.payloadHash, JSON.stringify(data.response)]),
    },
    interactionWorkspace: { update: async ({ where, data }: any) => tx.query(`UPDATE interaction_workspaces
      SET snapshot=$1::jsonb, revision=$2, sequence=$3, "contextEpoch"="contextEpoch"+1 WHERE id=$4`,
      [JSON.stringify(data.snapshot), data.revision, data.sequence, where.id]) },
    interactionEvent: { create: async ({ data }: any) => tx.query(`INSERT INTO interaction_events ("workspaceId", sequence, payload) VALUES ($1,$2,$3::jsonb)`,
      [data.workspaceId, data.sequence, JSON.stringify(data.payload)]) },
  })) };
  const repo = createPostgresInteractionRepository(prisma as any);
  const input = { ownerId, workspaceId: id, expectedRevision: 0, requestId: 'request-a',
    envelope: { actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
      action: { type: 'add_text_source', sourceId: 'source-a', label: 'Notes', text: 'Quorums overlap.' } }, plan: planCohortAction };
  const sql = { query: (s: string, p: unknown[]) => db.query<Record<string, unknown>>(s, p) };
  const port = { transaction: <T>(work: (tx: typeof sql) => Promise<T>) => db.transaction(tx => work({ query: (s, p) => tx.query<Record<string, unknown>>(s, p) })) };
  return { db, repo, input, sql, port };
}

describe('production canonical text repository integration', () => {
  it('commits source, DAG, receipt and event once through the authorized action path', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    const { db, repo, input } = await fixture();
    try {
      const first = await repo.commitAction(input);
      expect(await repo.commitAction(input)).toEqual(first);
      expect((await db.query(`SELECT * FROM cohort_text_jobs`)).rows).toHaveLength(5);
      expect((await db.query(`SELECT * FROM interaction_events`)).rows).toHaveLength(1);
      expect((await db.query(`SELECT * FROM interaction_requests`)).rows).toHaveLength(1);
      await expect(repo.commitAction({ ...input, requestId: 'foreign', ownerId: 'foreign' })).rejects.toThrow('WORKSPACE_NOT_FOUND');
    } finally { await db.close(); }
  }, 30_000);

  it('rolls snapshot, DAG and receipt back when event persistence fails', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    const { db, repo, input } = await fixture();
    try {
      await db.exec(`ALTER TABLE interaction_events ADD CHECK (sequence < 0)`);
      await expect(repo.commitAction(input)).rejects.toThrow();
      expect((await db.query(`SELECT * FROM cohort_text_jobs`)).rows).toHaveLength(0);
      expect((await db.query<{ revision: number }>(`SELECT revision FROM interaction_workspaces`)).rows[0].revision).toBe(0);
      expect((await db.query(`SELECT * FROM interaction_requests`)).rows).toHaveLength(0);
    } finally { await db.close(); }
  }, 30_000);

  it('persists failure status, targeted retry and cancellation through canonical receipts/events', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    const { db, repo, input, sql, port } = await fixture();
    try {
      await repo.commitAction(input);
      const now = new Date('2030-01-01T00:00:00.000Z');
      const job = (await claimTextJob(sql, 'worker', now, 60_000))!;
      expect(await failCurrentTextJob(port, job, 'PROCESSOR_FAILURE', now)).toBe(true);
      const failed = (await db.query<{ revision: number; snapshot: unknown }>(`SELECT revision, snapshot FROM interaction_workspaces`)).rows[0];
      expect(cohortWorkspaceSchema.parse(failed.snapshot).processing.jobs?.find(item => item.id === job.id)).toMatchObject({ status: 'failed', retryable: true });
      const retry = { ...input, expectedRevision: failed.revision, requestId: 'retry', envelope: { ...input.envelope,
        expectedRevision: failed.revision, action: { type: 'retry_text_job', jobId: job.id } } };
      const receipt = await repo.commitAction(retry);
      expect(await repo.commitAction(retry)).toEqual(receipt);
      expect((await sql.query(`SELECT "attempts", "status" FROM cohort_text_jobs WHERE id=$1`, [job.id])).rows[0]).toMatchObject({ attempts: 1, status: 'queued' });
      await repo.commitAction({ ...retry, expectedRevision: receipt.revision, requestId: 'cancel', envelope: { ...retry.envelope,
        expectedRevision: receipt.revision, action: { type: 'cancel_text_processing' } } });
      expect((await db.query(`SELECT * FROM cohort_text_jobs WHERE status='canceled'`)).rows).toHaveLength(5);
      expect((await db.query(`SELECT * FROM interaction_events`)).rows).toHaveLength(4);
    } finally { await db.close(); }
  }, 30_000);
});
