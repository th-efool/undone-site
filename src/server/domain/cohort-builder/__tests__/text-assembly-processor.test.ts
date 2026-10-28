import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cohortLessonSchema, cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from '../text-artifacts';
import { createTextAssemblyProcessor } from '../text-assembly-processor';
import { enqueueTextJobPlan, type TextJobTransactionPort } from '../text-job-scheduler';
import { runTextJobTick } from '../text-job-tick';
import { acceptTextJob, claimTextJob } from '../text-jobs';
import { createTextSourceProcessor } from '../text-source-processor';

const migration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-s3-storage.sql', import.meta.url), 'utf8');
const workspaceId = 'workspace-a';
const now = new Date('2030-01-01T00:00:00.000Z');
const initial = () => cohortWorkspaceSchema.parse({
  schemaVersion: 1, title: 'Systems', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 25, lessons: [],
  sources: [
    { id: 'source-a', version: 0, label: 'A', text: 'Quorums overlap.', checksum: null, state: 'queued' },
    { id: 'source-b', version: 0, label: 'B', text: 'Logs retain writes.', checksum: null, state: 'queued' },
  ],
});

async function setup() {
  const db = new PGlite();
  await db.exec('CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY)');
  await db.exec(migration);
  await db.query(`INSERT INTO "interaction_workspaces" ("id") VALUES ($1)`, [workspaceId]);
  const sql: TextArtifactSql = { query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters) };
  const port: TextJobTransactionPort = { transaction: work => db.transaction(tx => work({
    query: async (statement, parameters) => tx.query<Record<string, unknown>>(statement, parameters),
  })) };
  let state: CohortWorkspace = initial();
  await enqueueTextJobPlan(port, workspaceId, state);
  const source = createTextSourceProcessor({ sql, loadWorkspace: async () => state });
  const assembly = createTextAssemblyProcessor({ sql, loadWorkspace: async () => state });
  const tick = () => runTextJobTick({ sql, workerId: 'worker', leaseMs: 2_000, now: () => now,
    process: job => job.stage === 'assembly' ? assembly(job) : source(job),
    accept: (job, artifact, at) => acceptTextJob(sql, job, artifact, at),
  });
  return { db, sql, tick, assembly, setState: (next: CohortWorkspace) => { state = next; } };
}

describe('prepared global assembly processor', () => {
  it('assembles every accepted source with retained evidence and no workspace mutation', async () => {
    const { db, sql, tick } = await setup();
    try {
      for (let index = 0; index < 9; index += 1) expect((await tick()).status).toBe('accepted');
      const accepted = await sql.query(`SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "stage" = 'assembly'`, []);
      const artifact = await sql.query(`SELECT "body" FROM "cohort_text_artifacts" WHERE "id" = $1`, [accepted.rows[0].resultArtifactId]);
      const lessons = cohortLessonSchema.array().parse(JSON.parse(Buffer.from(artifact.rows[0].body as Uint8Array).toString('utf8')));
      expect(lessons).toHaveLength(2);
      expect(lessons.map(lesson => lesson.sourceChunkIds[0])).toEqual(['source-a:v0:0', 'source-b:v0:0']);
      expect((await tick()).status).toBe('idle');
    } finally { await db.close(); }
  }, 30_000);

  it('rejects stale plan, missing prerequisite, and foreign analysis identity', async () => {
    const { db, sql, tick, assembly, setState } = await setup();
    try {
      for (let index = 0; index < 8; index += 1) expect((await tick()).status).toBe('accepted');
      const job = (await claimTextJob(sql, 'worker', now, 2_000))!;
      const revised = initial();
      revised.intent = 'A different goal';
      setState(revised);
      await expect(assembly(job)).rejects.toThrow('STALE_ASSEMBLY_JOB');
      setState(initial());
      const edge = (await sql.query(`SELECT "prerequisiteId" FROM "cohort_text_job_edges" WHERE "jobId" = $1 LIMIT 1`, [job.id])).rows[0];
      await sql.query(`DELETE FROM "cohort_text_job_edges" WHERE "jobId" = $1 AND "prerequisiteId" = $2`, [job.id, edge.prerequisiteId]);
      await expect(assembly(job)).rejects.toThrow('MISSING_ASSEMBLY_PREREQUISITE');
      await sql.query(`INSERT INTO "cohort_text_job_edges" ("workspaceId", "jobId", "prerequisiteId") VALUES ($1, $2, $3)`,
        [workspaceId, job.id, edge.prerequisiteId]);
      await sql.query(`UPDATE "cohort_text_jobs" SET "sourceId" = 'foreign' WHERE "id" = $1`, [edge.prerequisiteId]);
      await expect(assembly(job)).rejects.toThrow('FOREIGN_ASSEMBLY_PREREQUISITE');
    } finally { await db.close(); }
  }, 30_000);

  it('rejects tampered retained analysis bytes', async () => {
    const { db, sql, tick, assembly } = await setup();
    try {
      for (let index = 0; index < 8; index += 1) expect((await tick()).status).toBe('accepted');
      const job = (await claimTextJob(sql, 'worker', now, 2_000))!;
      const retained = (await sql.query(`SELECT "body" FROM "cohort_text_artifacts" WHERE "id" =
        (SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "stage" = 'analysis' LIMIT 1)`, [])).rows[0];
      const tampered = Buffer.from(retained.body as Uint8Array);
      tampered[0] ^= 1;
      await sql.query(`UPDATE "cohort_text_artifacts" SET "body" = $1 WHERE "id" =
        (SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "stage" = 'analysis' LIMIT 1)`, [new Uint8Array(tampered)]);
      await expect(assembly(job)).rejects.toThrow('ARTIFACT_INTEGRITY');
    } finally { await db.close(); }
  }, 30_000);
});
