import { Pool } from 'pg';
import type { TextArtifactSql } from '@/src/server/domain/cohort-builder/text-artifacts';
import { assertTextJobSchema } from '@/src/server/domain/cohort-builder/text-schema-readiness';
import { runDurableTextJobTick } from '@/src/server/domain/cohort-builder/durable-text-worker';
import { recoverTextWorkspace } from '@/src/server/domain/cohort-builder/text-job-recovery';
import type { TextJobTransactionPort } from '@/src/server/domain/cohort-builder/text-job-scheduler';
import { assertSourceSchema } from '@/src/server/domain/cohort-builder/source-policy';

/** Same database as canonical commits; one checked-out connection per acceptance transaction. */
export async function createTextJobRuntime(connectionString: string, workerId: string, leaseMs: number) {
  const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 15_000,
    options: '-c timezone=UTC -c statement_timeout=15000 -c lock_timeout=5000' });
  const sql: TextArtifactSql = { query: (statement, parameters) => pool.query(statement, parameters) };
  try {
    await assertTextJobSchema(sql);
    const external=await sql.query(`SELECT "id" FROM "interaction_workspaces" WHERE "domainId"='cohort' AND "lifecycle"='active'
      AND EXISTS(SELECT 1 FROM jsonb_array_elements("snapshot"->'sources') source WHERE source ? 'input') LIMIT 1`,[]);
    if(process.env.INTERACTION_PDF_ENABLED==='1' || process.env.INTERACTION_WEB_ENABLED==='1' || external.rows.length) await assertSourceSchema(sql);
  } catch (error) { await pool.end(); throw error; }
  const transaction: TextJobTransactionPort = { transaction: async work => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work({ query: (statement, parameters) => client.query(statement, parameters) });
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } };
  return {
    close: () => pool.end(),
    tick: async () => {
      const candidates = await sql.query(`SELECT "id" FROM "interaction_workspaces" WHERE "domainId"='cohort'
        AND "lifecycle"='active' AND "snapshot"->'processing'->>'status' IN ('queued','failed')
        ORDER BY "updatedAt" LIMIT 20`, []);
      for (const row of candidates.rows) await recoverTextWorkspace(transaction, String(row.id));
      return runDurableTextJobTick({ sql, workerId, leaseMs, now: () => new Date(), transaction,
      loadWorkspace: async workspaceId => {
        const row = (await sql.query(`SELECT "snapshot" FROM "interaction_workspaces"
          WHERE "id" = $1 AND "lifecycle" = 'active' AND "domainId" = 'cohort'`, [workspaceId])).rows[0];
        if (!row) throw new Error('WORKSPACE_NOT_ACTIVE');
        return row.snapshot;
      },
    }); },
  };
}
