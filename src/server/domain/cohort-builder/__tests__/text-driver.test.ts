import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { textDriver } from '../text-driver';
import { assertTextJobSchema } from '../text-schema-readiness';

describe('durable driver readiness', () => {
  it('selects one driver and rejects unknown values', () => {
    expect(textDriver({})).toBe('snapshot');
    expect(textDriver({ INTERACTION_TEXT_DRIVER: 'durable' })).toBe('durable');
    expect(() => textDriver({ INTERACTION_TEXT_DRIVER: 'both' })).toThrow('INVALID_TEXT_DRIVER');
  });
  it('fails before schema installation and rejects unsupported queued handlers', async () => {
    const db = new PGlite();
    const sql = { query: async (s: string, p: unknown[]) => db.query<Record<string, unknown>>(s, p) };
    try {
      await expect(assertTextJobSchema(sql)).rejects.toThrow('S3_SCHEMA_NOT_INSTALLED');
      await db.exec('CREATE TABLE interaction_workspaces (id TEXT PRIMARY KEY)');
      await db.exec(readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8'));
      await expect(assertTextJobSchema(sql)).resolves.toBeUndefined();
      await db.exec(`INSERT INTO interaction_workspaces VALUES ('a');
        INSERT INTO cohort_text_jobs (id, "workspaceId", "jobKey", stage, "dependencyFingerprint", "handlerVersion")
        VALUES ('job','a','key','assembly','fingerprint',2)`);
      await expect(assertTextJobSchema(sql)).rejects.toThrow('S3_HANDLER_VERSION_UNSUPPORTED');
    } finally { await db.close(); }
  }, 30_000);
});
