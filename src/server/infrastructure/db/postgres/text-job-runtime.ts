import { Pool } from 'pg';
import type { TextArtifactSql } from '@/src/server/domain/cohort-builder/text-artifacts';
import { assertTextJobSchema } from '@/src/server/domain/cohort-builder/text-schema-readiness';
import { runDurableTextJobTick } from '@/src/server/domain/cohort-builder/durable-text-worker';

/** Same database as canonical commits; one checked-out connection per acceptance transaction. */
export async function createTextJobRuntime(connectionString: string, workerId: string, leaseMs: number) {
  const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 15_000 });
  const sql: TextArtifactSql = { query: (statement, parameters) => pool.query(statement, parameters) };
  try { await assertTextJobSchema(sql); } catch (error) { await pool.end(); throw error; }
  return {
    close: () => pool.end(),
    tick: () => runDurableTextJobTick({ sql, workerId, leaseMs, now: () => new Date(),
      transaction: { transaction: async work => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await work({ query: (statement, parameters) => client.query(statement, parameters) });
          await client.query('COMMIT');
          return result;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      } },
      loadWorkspace: async workspaceId => {
        const row = (await sql.query(`SELECT "snapshot" FROM "interaction_workspaces"
          WHERE "id" = $1 AND "lifecycle" = 'active' AND "domainId" = 'cohort'`, [workspaceId])).rows[0];
        if (!row) throw new Error('WORKSPACE_NOT_ACTIVE');
        return row.snapshot;
      },
    }),
  };
}
