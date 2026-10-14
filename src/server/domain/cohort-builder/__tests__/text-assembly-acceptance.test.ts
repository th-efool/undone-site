import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { putTextArtifact, type TextArtifactSql } from '../text-artifacts';
import { acceptAssemblyProjection } from '../text-assembly-acceptance';
import { enqueueTextJobPlan, type TextJobTransactionPort } from '../text-job-scheduler';
import { claimTextJob } from '../text-jobs';
import { runDurableTextJobTick } from '../durable-text-worker';
import { createTextAssemblyProcessor } from '../text-assembly-processor';

const migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const workspaceId = 'workspace-a';
const now = new Date('2030-01-01T00:00:00.000Z');
const state = (): CohortWorkspace => cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Systems', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 25,
  lessons: [{ id: 'manual:one', version: 0, title: 'Pinned', objective: 'Keep', sourceChunkIds: ['source-a:v0:0'], pinned: true }],
  sources: [{ id: 'source-a', version: 0, label: 'A', text: 'Quorums overlap.', checksum: null, state: 'queued' }],
});

async function setup() {
  const db = new PGlite();
  await db.exec('CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY, "snapshot" JSONB NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0)');
  await db.exec(migration);
  const sql: TextArtifactSql = { query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters) };
  const port: TextJobTransactionPort = { transaction: work => db.transaction(tx => work({ query: async (s, p) => tx.query<Record<string, unknown>>(s, p) })) };
  const current = state();
  await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot") VALUES ($1, $2::jsonb)`, [workspaceId, JSON.stringify(current)]);
  await enqueueTextJobPlan(port, workspaceId, current);
  const tick = () => runDurableTextJobTick({ sql, transaction: port, workerId: 'worker', leaseMs: 2_000, now: () => now,
    loadWorkspace: async () => (await sql.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0].snapshot,
  });
  for (let index = 0; index < 4; index++) expect((await tick()).status).toBe('accepted');
  const job = (await claimTextJob(sql, 'worker', now, 2_000))!;
  const assembly = await putTextArtifact(sql, { workspaceId, kind: 'assembly', inputFingerprint: job.dependencyFingerprint,
    bytes: await createTextAssemblyProcessor({ sql, loadWorkspace: async () => current })(job) });
  return { db, sql, port, job, assembly, tick };
}

describe('atomic assembly acceptance and projection', () => {
  it('projects generated lessons while preserving pinned lessons and advances revision', async () => {
    const { db, port, job, assembly } = await setup();
    try {
      expect(await acceptAssemblyProjection(port, job, assembly, now)).toBe(true);
      const row = await db.query<{ snapshot: CohortWorkspace; revision: number; status: string }>(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId]);
      expect(Number(row.rows[0].revision)).toBe(1);
      const projected = cohortWorkspaceSchema.parse(row.rows[0].snapshot);
      expect(projected.lessons.map(lesson => lesson.id)).toEqual(['manual:one', 'grounded:source-a:v0:0']);
      expect(projected.processing.stage).toBe('done');
      expect(projected.chunks).toHaveLength(1);
      expect(projected.analyses).toHaveLength(1);
      expect(projected.sources[0].state).toBe('ready');
    } finally { await db.close(); }
  }, 30_000);

  it('rejects expired acceptance without changing the workspace or accepting the job', async () => {
    const { db, port, job, assembly } = await setup();
    try {
      expect(await acceptAssemblyProjection(port, job, assembly, new Date(now.getTime() + 2_001))).toBe(false);
      const row = (await db.query<{ revision: number; snapshot: CohortWorkspace }>(`SELECT "revision", "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
      expect(row.revision).toBe(0);
      expect(row.snapshot.chunks).toHaveLength(0);
      expect((await db.query<{ status: string }>(`SELECT "status" FROM "cohort_text_jobs" WHERE "id" = $1`, [job.id])).rows[0].status).toBe('running');
    } finally { await db.close(); }
  }, 30_000);

  it('rejects fabricated lessons even when they cite a real chunk', async () => {
    const { db, sql, port, job } = await setup();
    try {
      const forged = await putTextArtifact(sql, { workspaceId, kind: 'assembly', inputFingerprint: job.dependencyFingerprint,
        bytes: Buffer.from(JSON.stringify([{ id: 'fake', version: 0, title: 'Fabricated', objective: 'Unsupported', sourceChunkIds: ['source-a:v0:0'], pinned: false }])) });
      expect(await acceptAssemblyProjection(port, job, forged, now)).toBe(false);
      expect((await db.query<{ revision: number }>(`SELECT "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0].revision).toBe(0);
    } finally { await db.close(); }
  }, 30_000);

  it('rejects a stale job without changing snapshot or revision', async () => {
    const { db, port, job, assembly } = await setup();
    try {
      await db.query(`UPDATE "interaction_workspaces" SET "snapshot" = jsonb_set("snapshot", '{intent}', '"Changed"') WHERE "id" = $1`, [workspaceId]);
      expect(await acceptAssemblyProjection(port, job, assembly, now)).toBe(false);
      const row = await db.query<{ revision: number }>(`SELECT "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId]);
      expect(Number(row.rows[0].revision)).toBe(0);
    } finally { await db.close(); }
  }, 30_000);

  it('resumes the composed worker after an assembly claim expires and does not duplicate projection', async () => {
    const { db, sql, port } = await setup();
    try {
      const tick = () => runDurableTextJobTick({ sql, transaction: port, workerId: 'replacement', leaseMs: 2_000,
        now: () => new Date(now.getTime() + 2_001),
        loadWorkspace: async () => (await sql.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0].snapshot,
      });
      expect((await tick()).status).toBe('accepted');
      expect((await tick()).status).toBe('idle');
      const row = (await db.query<{ revision: number; snapshot: CohortWorkspace }>(`SELECT "revision", "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
      expect(row.revision).toBe(1);
      expect(row.snapshot.lessons).toHaveLength(2);
      expect(row.snapshot.processing.status).toBe('ready');
    } finally { await db.close(); }
  }, 30_000);
});
