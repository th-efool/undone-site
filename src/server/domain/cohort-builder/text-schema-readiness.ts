import type { TextArtifactSql } from './text-artifacts';

export async function assertTextJobSchema(sql: TextArtifactSql): Promise<void> {
  const tables = await sql.query(`SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
  [['cohort_text_jobs', 'cohort_text_job_edges', 'cohort_text_artifacts']]);
  if (Number(tables.rows[0]?.count) !== 3) throw new Error('S3_SCHEMA_NOT_INSTALLED');
  const incompatible = await sql.query(`SELECT "id" FROM "cohort_text_jobs"
    WHERE "handlerVersion" NOT IN (1,2,3) AND "status" IN ('queued', 'running') LIMIT 1`, []);
  if (incompatible.rows.length) throw new Error('S3_HANDLER_VERSION_UNSUPPORTED');

  const constraints = (await sql.query(`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.contype = 'c'
      AND c.conname IN ('cohort_text_artifacts_kind_ck', 'cohort_text_jobs_stage_ck')
  `, [])).rows as Array<{ conname: string; def: string }>;
  const artifactKindCk = constraints.find(r => r.conname === 'cohort_text_artifacts_kind_ck');
  const jobStageCk = constraints.find(r => r.conname === 'cohort_text_jobs_stage_ck');
  const hasJourneyArtifactStages = Boolean(artifactKindCk?.def.includes('recommendations') && artifactKindCk?.def.includes('discovery'));
  const hasJourneyJobStages = Boolean(jobStageCk?.def.includes('recommendations') && jobStageCk?.def.includes('discovery'));

  const invTable = await sql.query(`SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cohort_model_invocations'`, []);
  const hasModelInvocationsTable = Number(invTable.rows[0]?.count) === 1;

  if (!hasJourneyArtifactStages || !hasJourneyJobStages || !hasModelInvocationsTable) {
    throw new Error('JOURNEY_STAGE_SCHEMA_NOT_INSTALLED');
  }
}

