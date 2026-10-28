import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from '../text-artifacts';
import { editSourceAndReconcileTextJobs } from '../text-source-reconciliation';
import { enqueueTextJobPlan, type TextJobTransactionPort } from '../text-job-scheduler';
import { claimTextJob } from '../text-jobs';

const migration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-s3-storage.sql', import.meta.url), 'utf8');
const workspaceId = 'workspace-a';
const makeState = () => cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'x', intent: 'Learn', audience: 'a', dailyMinutes: 10, lessons: [],
  sources: [{ id: 'source-a', version: 0, label: 'A', text: 'Original.', checksum: null, state: 'queued' }] });

describe('source edit and DAG reconciliation', () => {
  it('commits the new snapshot and supersedes only stale source work', async () => {
    const db = new PGlite();
    await db.exec('CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY, "snapshot" JSONB NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0)');
    await db.exec(migration);
    const sql: TextArtifactSql = { query: async (s, p) => db.query<Record<string, unknown>>(s, p) };
    const port: TextJobTransactionPort = { transaction: work => db.transaction(tx => work({ query: async (s, p) => tx.query<Record<string, unknown>>(s, p) })) };
    const state = makeState();
    await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot") VALUES ($1, $2::jsonb)`, [workspaceId, JSON.stringify(state)]);
    await enqueueTextJobPlan(port, workspaceId, state);
    const oldClaim = (await claimTextJob(sql, 'old-worker', new Date('2030-01-01T00:00:00.000Z'), 2_000))!;
    const result = await editSourceAndReconcileTextJobs(port, { workspaceId, sourceId: 'source-a', label: 'A revised', text: 'Updated.' });
    expect(result.revision).toBe(1);
    expect(result.superseded).toBe(5);
    const rows = await db.query<{ status: string; sourceVersion: number }>(`SELECT "status", "sourceVersion" FROM "cohort_text_jobs" WHERE "workspaceId" = $1`, [workspaceId]);
    expect(rows.rows.filter(row => row.status === 'superseded')).toHaveLength(5);
    expect(rows.rows.filter(row => row.status === 'queued' && Number(row.sourceVersion) === 1)).toHaveLength(4);
    expect(rows.rows.filter(row => row.status === 'queued' && row.sourceVersion === null)).toHaveLength(1);
    const oldRow = await db.query<{ status: string; fence: number }>(`SELECT "status", "fence" FROM "cohort_text_jobs" WHERE "id" = $1`, [oldClaim.id]);
    expect(oldRow.rows[0].status).toBe('superseded');
    expect(Number(oldRow.rows[0].fence)).toBeGreaterThan(oldClaim.fence);
    await db.close();
  }, 30_000);
});
