/** Reviewed additive builder rollout. Defaults to read-only preflight; --apply installs. */
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const files = [
  'packages/interaction-builder/migrations/001_interaction_schema.sql',
  'prisma/interaction-s3-storage.sql', 'prisma/interaction-s4b-sources.sql',
  'prisma/interaction-s5-effects.sql', 'prisma/interaction-s6-operations.sql',
  'prisma/interaction-workflow-dispatch.sql',
  'prisma/interaction-journey-stages.sql',
];
async function main() {
  const apply = process.argv.slice(2).join(' ') === '--apply';
  if (process.argv.length > 2 && !apply) throw new Error('Unsupported arguments');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
    connectionTimeoutMillis: 15_000, query_timeout: 30_000 });
  const client = await pool.connect();
  try {
    const baseline = await client.query(`SELECT to_regclass('public.users') IS NOT NULL AS users,
      to_regclass('public.creation_drafts') IS NOT NULL AS drafts`);
    if (!baseline.rows[0].users || !baseline.rows[0].drafts) throw new Error('Existing application baseline required');
    const before = await client.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND (starts_with(table_name,'interaction_') OR starts_with(table_name,'cohort_text_')) ORDER BY table_name`);
    console.log('Existing builder tables:', before.rows.map(row => row.table_name));
    if (!apply) { console.log('Read-only preflight passed. No changes applied.'); return; }
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='5s'");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('interaction-builder-rollout'))`);
    for (const file of files) {
      // SQL files own no nested transactions here; installation is all-or-nothing.
      const sql = (await readFile(file, 'utf8')).replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
      await client.query(sql);
      console.log('Applied:', file);
    }
    await client.query('COMMIT');
    console.log('Additive builder rollout committed. Existing drafts preserved.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error => {
  console.error('Builder rollout failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
