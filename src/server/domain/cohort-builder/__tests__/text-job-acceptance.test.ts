import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { putTextArtifact, type TextArtifactSql } from '../text-artifacts';
import { acceptCurrentTextJob } from '../text-job-acceptance';
import { runTextJobTick } from '../text-job-tick';
import { enqueueTextJobPlan, type TextJobTransactionPort } from '../text-job-scheduler';
import { claimTextJob } from '../text-jobs';
import { runDurableTextJobTick } from '../durable-text-worker';
import { createTextSourceProcessor } from '../text-source-processor';

const migration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-s3-storage.sql', import.meta.url), 'utf8');
const workspaceId = '7d4e49d0-bad0-4aba-a777-122326020002';
const now = new Date('2030-01-01T00:00:00.000Z');
const initial = () => cohortWorkspaceSchema.parse({
  schemaVersion: 1, title: 'Systems', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 25, lessons: [],
  sources: [{ id: 'source-a', version: 0, label: 'Notes', text: 'Quorums overlap.', checksum: null, state: 'queued' }],
});

async function setup(claim = true) {
  const db = new PGlite();
  await db.exec(`CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY, "snapshot" JSONB NOT NULL, "lifecycle" TEXT DEFAULT 'active', "domainId" TEXT DEFAULT 'cohort',
    "revision" INT DEFAULT 0, "sequence" INT DEFAULT 0, "contextEpoch" INT DEFAULT 0, "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "interaction_events" ("id" TEXT, "workspaceId" TEXT, "sequence" INT, "protocolVersion" INT, "type" TEXT, "revision" INT, "payload" JSONB)`);
  await db.exec(migration);
  const state = initial();
  await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot") VALUES ($1, $2::jsonb)`, [workspaceId, JSON.stringify(state)]);
  const sql: TextArtifactSql = { query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters) };
  const port: TextJobTransactionPort = { transaction: work => db.transaction(tx => work({
    query: async (statement, parameters) => tx.query<Record<string, unknown>>(statement, parameters),
  })) };
  await enqueueTextJobPlan(port, workspaceId, state);
  const job = claim ? (await claimTextJob(sql, 'worker', now, 2_000))! : null;
  const artifact = job ? await putTextArtifact(sql, { workspaceId, sourceId: 'source-a', sourceVersion: 0,
    kind: 'source_raw', inputFingerprint: job.dependencyFingerprint, bytes: Buffer.from(state.sources[0].text),
  }) : null;
  return { db, sql, port, state, job, artifact };
}

describe('workspace-fenced text job acceptance', () => {
  it('projects every accepted intermediate stage before assembly and persists its canonical progress', async () => {
    const { db, sql, port } = await setup(false);
    try {
      const loadWorkspace = async () => (await sql.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id"=$1`, [workspaceId])).rows[0].snapshot;
      const tick = () => runDurableTextJobTick({ sql, transaction: port, workerId: 'worker', leaseMs: 2_000, now: () => now, loadWorkspace });
      expect((await tick()).status).toBe('accepted');
      expect((await tick()).status).toBe('accepted');
      const understood = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(understood.understanding).toHaveLength(1);
      expect(understood.description).toBeTruthy();
      expect(understood.lessons).toHaveLength(0);
      expect((await tick()).status).toBe('accepted');
      const chunked = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(chunked.chunks).toHaveLength(1);
      expect(chunked.analyses).toHaveLength(0);
      expect((await tick()).status).toBe('accepted');
      const analyzed = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(analyzed.analyses.map(item => item.chunkId)).toEqual(chunked.chunks.map(item => item.id));
      expect(analyzed.lessons).toHaveLength(0);
      expect(analyzed.processing.jobs?.filter(job => job.status === 'accepted')).toHaveLength(4);
    } finally { await db.close(); }
  }, 30_000);

  it('rejects fabricated intermediate concepts without committing them', async () => {
    const { db, sql, port, job, artifact } = await setup();
    try {
      expect(await acceptCurrentTextJob(port, job!, artifact!, now)).toBe(true);
      const understandingJob = (await claimTextJob(sql, 'worker', now, 2_000))!;
      const loadWorkspace = async () => (await sql.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id"=$1`, [workspaceId])).rows[0].snapshot;
      const real = await createTextSourceProcessor({ sql, loadWorkspace })(understandingJob);
      const value = JSON.parse(Buffer.from(real).toString());
      value[0].topics = ['Fabricated concepts'];
      const forged = await putTextArtifact(sql, { workspaceId, sourceId: 'source-a', sourceVersion: 0,
        kind: 'understanding', inputFingerprint: understandingJob.dependencyFingerprint, bytes: Buffer.from(JSON.stringify(value)) });
      await expect(acceptCurrentTextJob(port, understandingJob, forged, now)).rejects.toThrow('FABRICATED_SOURCE_PROJECTION');
      expect(cohortWorkspaceSchema.parse(await loadWorkspace()).understanding).toHaveLength(0);
    } finally { await db.close(); }
  }, 30_000);

  it('rejects an edit committed after processing but before acceptance', async () => {
    const { db, port, state, job, artifact } = await setup();
    try {
      const edited = structuredClone(state);
      edited.sources[0].version = 1;
      edited.sources[0].text = 'Quorums now intersect.';
      await db.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb WHERE "id" = $2`, [JSON.stringify(edited), workspaceId]);
      expect(await acceptCurrentTextJob(port, job!, artifact!, now)).toBe(false);
      const result = await db.query<{ status: string; resultArtifactId: string | null }>(
        `SELECT "status", "resultArtifactId" FROM "cohort_text_jobs" WHERE "id" = $1`, [job!.id]);
      expect(result.rows[0]).toMatchObject({ status: 'running', resultArtifactId: null });
    } finally {
      await db.close();
    }
  }, 30_000);

  it('accepts before an edit, retaining history without making the old key current', async () => {
    const { db, port, state, job, artifact } = await setup();
    try {
      expect(await acceptCurrentTextJob(port, job!, artifact!, now)).toBe(true);
      const edited = structuredClone(state);
      edited.sources[0].version = 1;
      edited.sources[0].text = 'Quorums now intersect.';
      await db.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb WHERE "id" = $2`, [JSON.stringify(edited), workspaceId]);
      const revised = await enqueueTextJobPlan(port, workspaceId, edited);
      expect(revised.inserted).toBe(5);
      const old = await db.query<{ status: string }>(`SELECT "status" FROM "cohort_text_jobs" WHERE "id" = $1`, [job!.id]);
      expect(old.rows[0].status).toBe('accepted');
    } finally {
      await db.close();
    }
  }, 30_000);

  it('rejects a job key that is not in the canonical current graph', async () => {
    const { db, port, job, artifact } = await setup();
    try {
      await db.query(`UPDATE "cohort_text_jobs" SET "jobKey" = 'unplanned-key' WHERE "id" = $1`, [job!.id]);
      expect(await acceptCurrentTextJob(port, job!, artifact!, now)).toBe(false);
    } finally {
      await db.close();
    }
  }, 30_000);

  it('makes the tick report stale when source changes during processing', async () => {
    const { db, sql, port, state } = await setup(false);
    try {
      const result = await runTextJobTick({
        sql, workerId: 'worker', leaseMs: 2_000, now: () => now,
        process: async () => {
          const edited = structuredClone(state);
          edited.sources[0].version = 1;
          edited.sources[0].text = 'Quorums now intersect.';
          await db.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb WHERE "id" = $2`, [JSON.stringify(edited), workspaceId]);
          return Buffer.from(state.sources[0].text);
        },
        accept: (job, artifact, at) => acceptCurrentTextJob(port, job, artifact, at),
      });
      expect(result.status).toBe('stale');
      const jobs = await db.query<{ status: string; resultArtifactId: string | null }>(
        `SELECT "status", "resultArtifactId" FROM "cohort_text_jobs" WHERE "stage" = 'acquisition'`);
      expect(jobs.rows[0]).toMatchObject({ status: 'running', resultArtifactId: null });
    } finally {
      await db.close();
    }
  }, 30_000);
});
