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
});
