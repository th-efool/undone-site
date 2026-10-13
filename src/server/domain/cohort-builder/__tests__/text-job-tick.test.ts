import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import type { TextArtifactSql } from '../text-artifacts';
import { acceptTextJob, retryTextJob } from '../text-jobs';
import { runTextJobTick } from '../text-job-tick';

const migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const start = new Date('2026-10-13T10:00:00.000Z');
const later = (ms: number) => new Date(start.getTime() + ms);

async function setup() {
  const db = new PGlite();
  await db.exec('CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY)');
  await db.exec(migration);
  await db.exec(`INSERT INTO "interaction_workspaces" ("id") VALUES ('workspace-a')`);
  const sql: TextArtifactSql = { query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters) };
  return { db, sql };
}

describe('prepared durable text job tick', () => {
  it('advances prerequisites and resumes without repeating accepted work', async () => {
    const { db, sql } = await setup();
    try {
      await db.exec(`INSERT INTO "cohort_text_jobs" ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint", "dueAt")
        VALUES ('acquire', 'workspace-a', 'a', 'source-a', 0, 'acquisition', 'fp-a', '2020-01-01'),
               ('understand', 'workspace-a', 'b', 'source-a', 0, 'understanding', 'fp-b', '2020-01-01')`);
      await db.exec(`INSERT INTO "cohort_text_job_edges" ("workspaceId", "jobId", "prerequisiteId") VALUES ('workspace-a', 'understand', 'acquire')`);
      const seen: string[] = [];
      const tick = () => runTextJobTick({ sql, workerId: 'worker', leaseMs: 2_000, now: () => start,
        process: async job => { seen.push(job.id); return Buffer.from(job.id); },
        accept: (job, artifact, at) => acceptTextJob(sql, job, artifact, at),
      });
      expect(await tick()).toEqual({ status: 'accepted', jobId: 'acquire' });
      expect(await tick()).toEqual({ status: 'accepted', jobId: 'understand' });
      expect(await tick()).toEqual({ status: 'idle' });
      expect(seen).toEqual(['acquire', 'understand']);
      const artifacts = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM "cohort_text_artifacts"`);
      expect(artifacts.rows[0].count).toBe('2');
    } finally {
      await db.close();
    }
  }, 30_000);

  it('surfaces a bounded failure, retries, and rejects a late acceptance', async () => {
    const { db, sql } = await setup();
    try {
      await db.exec(`INSERT INTO "cohort_text_jobs" ("id", "workspaceId", "jobKey", "stage", "dependencyFingerprint", "dueAt")
        VALUES ('assemble', 'workspace-a', 'assembly', 'assembly', 'fp', '2020-01-01')`);
      let clock = start;
      const run = (process: () => Promise<Uint8Array>) => runTextJobTick({
        sql, workerId: 'worker', leaseMs: 2_000, now: () => clock, process,
        accept: (job, artifact, at) => acceptTextJob(sql, job, artifact, at),
      });
      expect(await run(async () => { throw new Error('MODEL_FAILED'); })).toEqual({ status: 'failed', jobId: 'assemble' });
      const failed = (await db.query<{ status: string; errorCode: string }>(
        `SELECT "status", "errorCode" FROM "cohort_text_jobs" WHERE "id" = 'assemble'`
      )).rows[0];
      expect(failed).toEqual({ status: 'failed', errorCode: 'MODEL_FAILED' });
      expect(await retryTextJob(sql, 'workspace-a', 'assemble', later(100))).toBe(true);
      clock = later(100);
      expect(await run(async () => { clock = later(2_101); return Buffer.from('late'); })).toEqual({ status: 'stale', jobId: 'assemble' });
      const accepted = await run(async () => Buffer.from('accepted'));
      expect(accepted).toEqual({ status: 'accepted', jobId: 'assemble' });
      const rows = await db.query<{ status: string }>(`SELECT "status" FROM "cohort_text_jobs" WHERE "id" = 'assemble'`);
      expect(rows.rows[0].status).toBe('accepted');
    } finally {
      await db.close();
    }
  }, 30_000);
});
