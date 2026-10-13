import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from '../text-artifacts';
import { planTextJobs } from '../text-job-plan';
import { enqueueTextJobPlan, type TextJobTransactionPort } from '../text-job-scheduler';
import { runTextJobTick } from '../text-job-tick';
import { acceptTextJob, claimTextJob, retryTextJob } from '../text-jobs';
import { createTextSourceProcessor } from '../text-source-processor';

const migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const now = new Date('2030-01-01T00:00:00.000Z');
const workspaceId = 'workspace-a';
const initial = () => cohortWorkspaceSchema.parse({
  schemaVersion: 1, title: 'Systems', intent: 'Learn distributed systems', audience: 'Engineers', dailyMinutes: 25, lessons: [],
  sources: [
    { id: 'source-a', version: 0, label: 'A', text: 'Quorums overlap. Consensus orders writes.', checksum: null, state: 'queued' },
    { id: 'source-b', version: 0, label: 'B', text: 'Logs retain writes. Retries repeat safely.', checksum: null, state: 'queued' },
  ],
});

async function setup() {
  const db = new PGlite();
  await db.exec('CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY)');
  await db.exec(migration);
  await db.exec(`INSERT INTO "interaction_workspaces" ("id") VALUES ('workspace-a')`);
  const sql: TextArtifactSql = { query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters) };
  const port: TextJobTransactionPort = { transaction: work => db.transaction(tx => work({
    query: async (statement, parameters) => tx.query<Record<string, unknown>>(statement, parameters),
  })) };
  return { db, sql, port };
}

describe('owned per-source deterministic artifact processor', () => {
  it('accepts both source chains and recomputes only an edited source', async () => {
    const { db, sql, port } = await setup();
    try {
      let state: CohortWorkspace = initial();
      await enqueueTextJobPlan(port, workspaceId, state);
      const processor = createTextSourceProcessor({ sql, loadWorkspace: async () => state });
      const tick = () => runTextJobTick({ sql, workerId: 'worker', leaseMs: 2_000, now: () => now, process: processor,
        accept: (job, artifact, at) => acceptTextJob(sql, job, artifact, at),
      });
      for (let index = 0; index < 8; index += 1) expect((await tick()).status).toBe('accepted');
      const first = await db.query<{ sourceId: string; status: string; resultArtifactId: string }>(
        `SELECT "sourceId", "status", "resultArtifactId" FROM "cohort_text_jobs" WHERE "sourceId" IS NOT NULL`);
      expect(first.rows).toHaveLength(8);
      expect(first.rows.every(row => row.status === 'accepted' && row.resultArtifactId)).toBe(true);
      const oldB = first.rows.filter(row => row.sourceId === 'source-b').map(row => row.resultArtifactId).sort();

      state = structuredClone(state);
      state.sources[0].version = 1;
      state.sources[0].text = 'Quorums intersect. Consensus orders writes.';
      const revised = await enqueueTextJobPlan(port, workspaceId, state);
      expect(revised.inserted).toBe(5);
      for (let index = 0; index < 4; index += 1) expect((await tick()).status).toBe('accepted');
      const currentKeys = planTextJobs(state).filter(intent => intent.sourceId === 'source-a').map(intent => intent.jobKey);
      const current = await db.query<{ status: string }>(
        `SELECT "status" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" = ANY($2::text[])`, [workspaceId, currentKeys]);
      expect(current.rows).toHaveLength(4);
      expect(current.rows.every(row => row.status === 'accepted')).toBe(true);
      const afterB = await db.query<{ resultArtifactId: string }>(
        `SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "sourceId" = 'source-b' ORDER BY "resultArtifactId"`);
      expect(afterB.rows.map(row => row.resultArtifactId)).toEqual(oldB);
    } finally {
      await db.close();
    }
  }, 30_000);

  it('keeps another source progressing while one fails, then retries only the failed node', async () => {
    const { db, sql, port } = await setup();
    try {
      const state = initial();
      await enqueueTextJobPlan(port, workspaceId, state);
      const processor = createTextSourceProcessor({ sql, loadWorkspace: async () => state });
      let failA = true;
      const tick = () => runTextJobTick({ sql, workerId: 'worker', leaseMs: 2_000, now: () => now,
        accept: (job, artifact, at) => acceptTextJob(sql, job, artifact, at),
        process: async job => {
          if (job.sourceId === 'source-a' && job.stage === 'acquisition' && failA) {
            failA = false;
            throw new Error('SOURCE_PROCESSING_FAILED');
          }
          return processor(job);
        },
      });
      const outcomes = [];
      for (let index = 0; index < 5; index += 1) outcomes.push((await tick()).status);
      expect(outcomes).toContain('failed');
      expect(outcomes.filter(status => status === 'accepted')).toHaveLength(4);
      const failed = (await db.query<{ id: string; errorCode: string }>(
        `SELECT "id", "errorCode" FROM "cohort_text_jobs" WHERE "status" = 'failed'`)).rows;
      expect(failed).toHaveLength(1);
      expect(failed[0].errorCode).toBe('SOURCE_PROCESSING_FAILED');
      expect((await tick()).status).toBe('idle');
      expect(await retryTextJob(sql, workspaceId, failed[0].id, now)).toBe(true);
      for (let index = 0; index < 4; index += 1) expect((await tick()).status).toBe('accepted');
      const analyses = await db.query<{ sourceId: string }>(
        `SELECT "sourceId" FROM "cohort_text_jobs" WHERE "stage" = 'analysis' AND "status" = 'accepted'`);
      expect(analyses.rows.map(row => row.sourceId).sort()).toEqual(['source-a', 'source-b']);
    } finally {
      await db.close();
    }
  }, 30_000);

  it('rejects a changed source and a tampered accepted prerequisite', async () => {
    const { db, sql, port } = await setup();
    try {
      let state = initial();
      state.sources = state.sources.slice(0, 1);
      await enqueueTextJobPlan(port, workspaceId, state);
      const processor = createTextSourceProcessor({ sql, loadWorkspace: async () => state });
      const acquisition = (await claimTextJob(sql, 'worker', now, 2_000))!;
      state = structuredClone(state);
      state.sources[0].version = 1;
      state.sources[0].text = 'Revised source.';
      await expect(processor(acquisition)).rejects.toThrow('STALE_SOURCE_JOB');

      state = initial();
      state.sources = state.sources.slice(0, 1);
      const result = await runTextJobTick({ sql, workerId: 'replacement', leaseMs: 2_000,
        now: () => new Date(now.getTime() + 2_001), process: processor,
        accept: (job, artifact, at) => acceptTextJob(sql, job, artifact, at),
      });
      expect(result.status).toBe('accepted');
      const acceptedId = result.jobId!;
      await db.query(`UPDATE "cohort_text_artifacts" SET "checksum" = $1 WHERE "id" =
        (SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "id" = $2)`, ['f'.repeat(64), acceptedId]);
      const understanding = (await claimTextJob(sql, 'worker', new Date(now.getTime() + 2_001), 2_000))!;
      expect(understanding.stage).toBe('understanding');
      await expect(processor(understanding)).rejects.toThrow('ARTIFACT_INTEGRITY');
    } finally {
      await db.close();
    }
  }, 30_000);
});
