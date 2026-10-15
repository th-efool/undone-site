import type { TextArtifactSql } from './text-artifacts';

/** Asserts that S5 release effect journaling schema and constraints are installed in PostgreSQL. */
export async function assertReleaseSchema(sql: TextArtifactSql): Promise<void> {
  const tableRes = await sql.query(
    "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interaction_effects'",
    []
  );
  if (Number(tableRes.rows[0]?.count) !== 1) {
    throw new Error('S5_EFFECTS_SCHEMA_NOT_INSTALLED');
  }

  const constraintRes = await sql.query(
    `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
     WHERE conrelid = 'interaction_effects'::regclass
       AND conname IN ('interaction_effects_state_ck', 'interaction_effects_mode_ck')`,
    []
  );
  if (constraintRes.rows.length !== 2) {
    throw new Error('S5_EFFECTS_CONSTRAINTS_NOT_INSTALLED');
  }
}
