import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { enqueueTextJobPlan, type TextJobTransactionPort } from '../text-job-scheduler';

const migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const workspace = cohortWorkspaceSchema.parse({
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
  await db.exec(`INSERT INTO "interaction_workspaces" ("id") VALUES ('workspace-a')`);
  const port: TextJobTransactionPort = {
    transaction: work => db.transaction(tx => work({ query: async (statement, parameters) => tx.query<Record<string, unknown>>(statement, parameters) })),
  };
  return { db, port };
}

describe('atomic cohort text job scheduling', () => {
  it('inserts the complete DAG once and safely reuses job identities', async () => {
    const { db, port } = await setup();
    try {
      const first = await enqueueTextJobPlan(port, 'workspace-a', workspace);
      expect(first.inserted).toBe(9);
      const second = await enqueueTextJobPlan(port, 'workspace-a', workspace);
      expect(second.inserted).toBe(0);
      expect(second.jobIds).toEqual(first.jobIds);
      const jobs = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM "cohort_text_jobs"`);
      const edges = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM "cohort_text_job_edges"`);
      expect(jobs.rows[0].count).toBe('9');
      expect(edges.rows[0].count).toBe('8');
    } finally {
      await db.close();
    }
  }, 30_000);

  it('rolls back every new job if an edge write fails', async () => {
    const { db, port } = await setup();
    const brokenPort: TextJobTransactionPort = {
      transaction: work => port.transaction(tx => work({
        query: (statement, parameters) => {
          if (statement.includes('INSERT INTO "cohort_text_job_edges"')) throw new Error('INJECTED_EDGE_FAILURE');
          return tx.query(statement, parameters);
        },
      })),
    };
    try {
      await expect(enqueueTextJobPlan(brokenPort, 'workspace-a', workspace)).rejects.toThrow('INJECTED_EDGE_FAILURE');
      const jobs = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM "cohort_text_jobs"`);
      expect(jobs.rows[0].count).toBe('0');
    } finally {
      await db.close();
    }
  }, 30_000);

  it('supersedes only invalidated graph nodes and clears work when source scope is empty', async () => {
    const { db, port } = await setup();
    try {
      const first = await enqueueTextJobPlan(port, 'workspace-a', workspace);
      await db.exec(`UPDATE "cohort_text_jobs" SET "status" = 'running', "leaseOwner" = 'old-worker',
        "leaseToken" = 'old-token', "leaseUntil" = '2030-01-01' WHERE "id" = '${first.jobIds[0]}'`);
      const edited = structuredClone(workspace);
      edited.sources[0].version = 1;
      edited.sources[0].text = 'Quorums need overlap.';
      const brokenPort: TextJobTransactionPort = {
        transaction: work => port.transaction(tx => work({
          query: (statement, parameters) => {
            if (statement.includes('INSERT INTO "cohort_text_job_edges"')) throw new Error('INJECTED_EDGE_FAILURE');
            return tx.query(statement, parameters);
          },
        })),
      };
      await expect(enqueueTextJobPlan(brokenPort, 'workspace-a', edited)).rejects.toThrow('INJECTED_EDGE_FAILURE');
      const beforeCommit = (await db.query<{ status: string; leaseToken: string | null }>(
        `SELECT "status", "leaseToken" FROM "cohort_text_jobs" WHERE "id" = $1`, [first.jobIds[0]]
      )).rows[0];
      expect(beforeCommit).toMatchObject({ status: 'running', leaseToken: 'old-token' });
      const second = await enqueueTextJobPlan(port, 'workspace-a', edited);
      expect(second).toMatchObject({ inserted: 5, superseded: 5 });
      const old = (await db.query<{ status: string; fence: number; leaseToken: string | null }>(
        `SELECT "status", "fence", "leaseToken" FROM "cohort_text_jobs" WHERE "id" = $1`, [first.jobIds[0]]
      )).rows[0];
      expect(old).toMatchObject({ status: 'superseded', fence: 1, leaseToken: null });
      const unchanged = (await db.query<{ status: string }>(
        `SELECT "status" FROM "cohort_text_jobs" WHERE "id" = $1`, [first.jobIds[4]]
      )).rows[0];
      expect(unchanged.status).toBe('queued');
      const noSources = { ...edited, sources: [] };
      const cleared = await enqueueTextJobPlan(port, 'workspace-a', noSources);
      expect(cleared).toEqual({ jobIds: [], inserted: 0, superseded: 9 });
      const active = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM "cohort_text_jobs" WHERE "status" IN ('queued', 'running', 'failed')`);
      expect(active.rows[0].count).toBe('0');
    } finally {
      await db.close();
    }
  }, 30_000);

  it('reactivates a superseded key when the earlier goal returns', async () => {
    const { db, port } = await setup();
    try {
      const first = await enqueueTextJobPlan(port, 'workspace-a', workspace);
      const originalAssemblyId = first.jobIds.at(-1)!;
      const changedGoal = { ...workspace, intent: 'Learn log replication' };
      const changed = await enqueueTextJobPlan(port, 'workspace-a', changedGoal);
      expect(changed).toMatchObject({ inserted: 1, superseded: 1 });
      const restored = await enqueueTextJobPlan(port, 'workspace-a', workspace);
      expect(restored.jobIds.at(-1)).toBe(originalAssemblyId);
      expect(restored).toMatchObject({ inserted: 0, superseded: 1 });
      const assembly = (await db.query<{ status: string; fence: number; attempts: number }>(
        `SELECT "status", "fence", "attempts" FROM "cohort_text_jobs" WHERE "id" = $1`, [originalAssemblyId]
      )).rows[0];
      expect(assembly).toMatchObject({ status: 'queued', fence: 2, attempts: 0 });
    } finally {
      await db.close();
    }
  }, 30_000);
});
