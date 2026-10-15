import type { TextArtifactSql } from './text-artifacts';

/**
 * Asserts that S6 operational schema (artifact protection, retention audit,
 * worker supervision heartbeats, and admin controls) is installed in PostgreSQL.
 */
export async function assertS6OperationalSchema(sql: TextArtifactSql): Promise<void> {
  const s6Tables = [
    'cohort_text_artifact_protection',
    'cohort_retention_audit_log',
    'interaction_worker_heartbeats',
    'cohort_admin_controls',
    'cohort_admin_control_audit',
  ];

  const tableRes = await sql.query(
    "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
    [s6Tables]
  );

  const foundCount = Number(tableRes.rows[0]?.count ?? 0);
  if (foundCount !== s6Tables.length) {
    throw new Error(`S6_OPERATIONAL_SCHEMA_NOT_INSTALLED: found ${foundCount} of ${s6Tables.length} tables`);
  }

  const idxRes = await sql.query(
    `SELECT count(*)::int AS count FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN ('cohort_text_artifact_protection_lease_idx', 'interaction_worker_heartbeats_last_idx')`,
    []
  );

  if (Number(idxRes.rows[0]?.count ?? 0) < 2) {
    throw new Error('S6_OPERATIONAL_INDEXES_NOT_INSTALLED');
  }
}
