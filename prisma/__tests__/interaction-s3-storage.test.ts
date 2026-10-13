import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../interaction-s3-storage.sql', import.meta.url), 'utf8');
const sha = 'a'.repeat(64);

describe('prepared S3 storage migration in isolated PostgreSQL', () => {
  it('creates additive owned tables and rejects invalid or cross-workspace references', async () => {
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
    const db = new PGlite();
    try {
      await db.exec('CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY)');
      await db.exec(migration);
      await db.exec(migration); // repeatable deployment
      await db.exec(`INSERT INTO "interaction_workspaces" ("id") VALUES ('owner-a'), ('owner-b')`);
      await db.query(`INSERT INTO "cohort_text_artifacts"
        ("id", "workspaceId", "sourceId", "sourceVersion", "kind", "inputFingerprint", "checksum", "byteLength", "body")
        VALUES ('artifact-a', 'owner-a', 'source-1', 0, 'source_raw', 'fingerprint', $1, 4, $2)`, [sha, new Uint8Array([1, 2, 3, 4])]);
      await db.exec(`INSERT INTO "cohort_text_jobs" ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint", "resultArtifactId")
        VALUES ('job-a', 'owner-a', 'source-1-acquisition', 'source-1', 0, 'acquisition', 'fingerprint', 'artifact-a'),
               ('job-b', 'owner-b', 'source-2-acquisition', 'source-2', 0, 'acquisition', 'fingerprint', NULL),
               ('job-c', 'owner-a', 'source-1-chunking', 'source-1', 0, 'chunking', 'fingerprint', NULL)`);
      await db.exec(`INSERT INTO "cohort_text_job_edges" ("workspaceId", "jobId", "prerequisiteId") VALUES ('owner-a', 'job-c', 'job-a')`);
      await expect(db.exec(`INSERT INTO "cohort_text_job_edges" ("workspaceId", "jobId", "prerequisiteId") VALUES ('owner-a', 'job-c', 'job-b')`)).rejects.toThrow();
      await expect(db.exec(`UPDATE "cohort_text_jobs" SET "resultArtifactId" = 'artifact-a' WHERE "id" = 'job-b'`)).rejects.toThrow();
      await expect(db.exec(`INSERT INTO "cohort_text_artifacts"
        ("id", "workspaceId", "kind", "inputFingerprint", "checksum", "byteLength", "body")
        VALUES ('bad-bytes', 'owner-a', 'analysis', 'fingerprint', '${sha}', 999, '\\x01')`)).rejects.toThrow();
      const accepted = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM "cohort_text_job_edges"`);
      expect(accepted.rows[0].count).toBe('1');
    } finally {
      await db.close();
    }
  });
});
