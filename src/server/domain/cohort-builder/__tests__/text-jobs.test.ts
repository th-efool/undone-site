import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { putTextArtifact, type TextArtifactSql } from '../text-artifacts';
import { acceptTextJob, claimTextJob, failTextJob, heartbeatTextJob, retryTextJob, supersedeTextSourceJobs } from '../text-jobs';

const migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const start = new Date('2026-10-13T10:00:00.000Z');
const later = (ms: number) => new Date(start.getTime() + ms);

async function setup() {
  const db = new PGlite();
  await db.exec('CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY)');
  await db.exec(migration);
  await db.exec(`INSERT INTO "interaction_workspaces" ("id") VALUES ('workspace-a'), ('workspace-b')`);
  const sql: TextArtifactSql = { query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters) };
  return { db, sql };
}

describe('durable text job leases and dependencies', () => {
  it('waits for prerequisites, fences an expired worker, and accepts only owned evidence', async () => {
    const { db, sql } = await setup();
    try {
      await db.exec(`INSERT INTO "cohort_text_jobs" ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint", "dueAt")
        VALUES ('job-acquire', 'workspace-a', 'a', 'source-1', 0, 'acquisition', 'fingerprint-a', '2020-01-01'),
               ('job-chunk', 'workspace-a', 'b', 'source-1', 0, 'chunking', 'fingerprint-b', '2020-01-01')`);
      await db.exec(`INSERT INTO "cohort_text_job_edges" ("workspaceId", "jobId", "prerequisiteId") VALUES ('workspace-a', 'job-chunk', 'job-acquire')`);
      const first = (await claimTextJob(sql, 'worker-1', start, 2_000))!;
      expect(first.id).toBe('job-acquire');
      expect(await claimTextJob(sql, 'worker-2', start, 2_000)).toBeNull();
      expect(await heartbeatTextJob(sql, first, later(1_000), 2_000)).toBe(true);
      const acquired = await putTextArtifact(sql, { workspaceId: 'workspace-a', sourceId: 'source-1', sourceVersion: 0, kind: 'source_raw', inputFingerprint: 'fingerprint-a', bytes: Buffer.from('Source text') });
      expect(await acceptTextJob(sql, first, acquired, later(1_500))).toBe(true);
      const chunkFirst = (await claimTextJob(sql, 'worker-1', later(1_500), 2_000))!;
      expect(chunkFirst.id).toBe('job-chunk');
      const foreign = await putTextArtifact(sql, { workspaceId: 'workspace-b', kind: 'chunks', inputFingerprint: 'fingerprint-b', bytes: Buffer.from('[]') });
      expect(await acceptTextJob(sql, chunkFirst, foreign, later(1_600))).toBe(false);
      const wrongSource = await putTextArtifact(sql, { workspaceId: 'workspace-a', sourceId: 'source-2', sourceVersion: 0, kind: 'chunks', inputFingerprint: 'fingerprint-b', bytes: Buffer.from('[]') });
      expect(await acceptTextJob(sql, chunkFirst, wrongSource, later(1_600))).toBe(false);
      const wrongKind = await putTextArtifact(sql, { workspaceId: 'workspace-a', sourceId: 'source-1', sourceVersion: 0, kind: 'analysis', inputFingerprint: 'fingerprint-b', bytes: Buffer.from('[]') });
      expect(await acceptTextJob(sql, chunkFirst, wrongKind, later(1_600))).toBe(false);
      const chunkSecond = (await claimTextJob(sql, 'worker-2', later(4_000), 2_000))!;
      expect(chunkSecond.id).toBe('job-chunk');
      expect(chunkSecond.fence).toBeGreaterThan(chunkFirst.fence);
      expect(await heartbeatTextJob(sql, chunkFirst, later(4_100), 2_000)).toBe(false);
      const chunks = await putTextArtifact(sql, { workspaceId: 'workspace-a', sourceId: 'source-1', sourceVersion: 0, kind: 'chunks', inputFingerprint: 'fingerprint-b', bytes: Buffer.from('[]') });
      expect(await acceptTextJob(sql, chunkFirst, chunks, later(4_100))).toBe(false);
      await expect(acceptTextJob(sql, chunkSecond, { ...chunks, checksum: 'f'.repeat(64) }, later(4_100))).rejects.toThrow('ARTIFACT_CONTRACT_MISMATCH');
      expect(await acceptTextJob(sql, chunkSecond, chunks, later(4_100))).toBe(true);
      expect(await claimTextJob(sql, 'worker-3', later(4_200), 2_000)).toBeNull();
    } finally {
      await db.close();
    }
  }, 30_000);

  it('makes failures retryable within a ceiling and revokes old source jobs', async () => {
    const { db, sql } = await setup();
    try {
      await db.exec(`INSERT INTO "cohort_text_jobs" ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint", "dueAt")
        VALUES ('job-old', 'workspace-a', 'old', 'source-1', 0, 'analysis', 'old-fingerprint', '2020-01-01')`);
      const claimed = (await claimTextJob(sql, 'worker-1', start, 2_000))!;
      expect(await failTextJob(sql, claimed, 'PARTIAL_FAILURE', later(100))).toBe(true);
      expect(await retryTextJob(sql, 'workspace-b', 'job-old', later(100))).toBe(false);
      expect(await retryTextJob(sql, 'workspace-a', 'job-old', later(100))).toBe(true);
      const retry = (await claimTextJob(sql, 'worker-2', later(100), 2_000))!;
      expect(retry.fence).toBeGreaterThan(claimed.fence);
      expect(await supersedeTextSourceJobs(sql, 'workspace-a', 'source-1', 1)).toBe(1);
      expect(await failTextJob(sql, retry, 'LATE_FAILURE', later(200))).toBe(false);
      expect(await claimTextJob(sql, 'worker-3', later(3_000), 2_000)).toBeNull();
    } finally {
      await db.close();
    }
  }, 30_000);

  it('does not let an expired worker report failure before a replacement claims the job', async () => {
    const { db, sql } = await setup();
    try {
      await db.exec(`INSERT INTO "cohort_text_jobs" ("id", "workspaceId", "jobKey", "stage", "dependencyFingerprint", "dueAt")
        VALUES ('job-expired', 'workspace-a', 'expired', 'assembly', 'fingerprint', '2020-01-01')`);
      const expired = (await claimTextJob(sql, 'worker-1', start, 2_000))!;
      expect(await failTextJob(sql, expired, 'LATE_ERROR', later(2_001))).toBe(false);
      const replacement = (await claimTextJob(sql, 'worker-2', later(2_001), 2_000))!;
      expect(replacement.fence).toBeGreaterThan(expired.fence);
      expect(await failTextJob(sql, replacement, 'RETRYABLE_ERROR', later(2_100))).toBe(true);
      expect(await retryTextJob(sql, 'workspace-a', 'job-expired', later(2_200))).toBe(true);
    } finally {
      await db.close();
    }
  }, 30_000);
});
