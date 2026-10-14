import type { TextArtifactSql } from './text-artifacts';

export async function assertTextJobSchema(sql: TextArtifactSql): Promise<void> {
  const tables = await sql.query(`SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
  [['cohort_text_jobs', 'cohort_text_job_edges', 'cohort_text_artifacts']]);
  if (Number(tables.rows[0]?.count) !== 3) throw new Error('S3_SCHEMA_NOT_INSTALLED');
  const incompatible = await sql.query(`SELECT "id" FROM "cohort_text_jobs"
    WHERE "handlerVersion" NOT IN (1,2) AND "status" IN ('queued', 'running') LIMIT 1`, []);
  if (incompatible.rows.length) throw new Error('S3_HANDLER_VERSION_UNSUPPORTED');
}
