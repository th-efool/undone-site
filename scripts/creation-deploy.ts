/** First installation only. Defaults to rollback; --apply commits reviewed additive SQL. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const files = ['creation-draft.sql', 'creation-durability.sql', 'creation-retention.sql',
  'creation-connectors.sql', 'creation-review.sql', 'creation-publication.sql'];
const expectedTables = ['creation_drafts', 'creation_jobs', 'creation_events', 'creation_budgets',
  'creation_storage_objects', 'creation_conversation_entries', 'creation_publication_reservations', 'creation_publications'];
let stage = 'configuration';
async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--apply'), 'Unsupported arguments');
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
    connectionTimeoutMillis: 10_000, query_timeout: 30_000 });
  const client = await pool.connect().catch(async error => { await pool.end(); throw error; });
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL search_path = public; SET LOCAL lock_timeout = '10s'; SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('creation-first-install'))");
    stage = 'baseline validation';
    const baseline = await client.query("SELECT to_regclass('public.users') IS NOT NULL AS users, to_regclass('public.cohorts') IS NOT NULL AS cohorts");
    assert.ok(baseline.rows[0].users && baseline.rows[0].cohorts, 'Existing application tables required');
    const installed = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND starts_with(table_name,'creation_')");
    assert.equal(installed.rowCount, 0, 'Creation tables exist: inspect installation before applying non-rerunnable scripts');
    for (const file of files) {
      stage = file;
      await client.query(await readFile(new URL(`../prisma/${file}`, import.meta.url), 'utf8'));
    }
    stage = 'post-install validation';
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])", [expectedTables]);
    assert.equal(tables.rowCount, expectedTables.length);
    const fields = await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='creation_drafts' AND column_name IN ('expiredAt','eventSequence')) OR (table_name='cohorts' AND column_name='creationSettings'))");
    assert.equal(fields.rowCount, 3);
    const connectors = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='creation_connectors' AND starts_with(table_name,'corsair_')");
    assert.equal(connectors.rows[0].count, 5);
    await client.query(args[0] === '--apply' ? 'COMMIT' : 'ROLLBACK');
    console.log(`${args[0] === '--apply' ? 'Applied' : 'Validated and rolled back'} six creation SQL scripts: eight public creation tables, five isolated connector tables and three additive columns verified.`);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(() => {
  console.error(`Creation first-install failed at ${stage}; transaction rolled back. Credentials and server errors suppressed.`);
  process.exitCode = 1;
});
