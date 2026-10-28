import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import { textDriver } from '../text-driver';
import { assertTextJobSchema, ensureJourneyStageSchema, resetSchemaReadinessCacheForTest } from '../text-schema-readiness';

describe('durable driver readiness', () => {
  it('selects one driver and rejects unknown values', () => {
    expect(textDriver({})).toBe('snapshot');
    expect(textDriver({ INTERACTION_TEXT_DRIVER: 'durable' })).toBe('durable');
    expect(() => textDriver({ INTERACTION_TEXT_DRIVER: 'both' })).toThrow('INVALID_TEXT_DRIVER');
  });
  it('fails before schema installation and rejects unsupported queued handlers', async () => {
    resetSchemaReadinessCacheForTest();
    const db = new PGlite();
    const sql = { query: async (s: string, p: unknown[]) => db.query<Record<string, unknown>>(s, p) };
    try {
      await expect(assertTextJobSchema(sql)).rejects.toThrow('S3_SCHEMA_NOT_INSTALLED');
      await db.exec('CREATE TABLE interaction_workspaces (id TEXT PRIMARY KEY)');
      await db.exec(readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-s3-storage.sql', import.meta.url), 'utf8'));
      await expect(assertTextJobSchema(sql)).rejects.toThrow('JOURNEY_STAGE_SCHEMA_NOT_INSTALLED');
      await db.exec(readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-journey-stages.sql', import.meta.url), 'utf8'));
      await expect(assertTextJobSchema(sql)).resolves.toBeUndefined();

      // Invalidate cache to test handler version rejection
      resetSchemaReadinessCacheForTest();
      await db.exec(`INSERT INTO interaction_workspaces VALUES ('a');
        INSERT INTO cohort_text_jobs (id, "workspaceId", "jobKey", stage, "dependencyFingerprint", "handlerVersion")
        VALUES ('job','a','key','assembly','fingerprint',99)`);
      await expect(assertTextJobSchema(sql)).rejects.toThrow('S3_HANDLER_VERSION_UNSUPPORTED');
    } finally {
      resetSchemaReadinessCacheForTest();
      await db.close();
    }
  }, 30_000);

  it('caches schema readiness in-memory and bypasses queries on subsequent checks until reset', async () => {
    resetSchemaReadinessCacheForTest();
    const querySpy = vi.fn<(_sql: string, _values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>>(
      async () => ({ rows: [] })
    );
    const mockSql = { query: querySpy };

    // Initially uncached - will query
    querySpy.mockResolvedValueOnce({ rows: [{ count: 3 }] }); // tables
    querySpy.mockResolvedValueOnce({ rows: [] }); // incompatible handler
    querySpy.mockResolvedValueOnce({
      rows: [
        { conname: 'cohort_text_artifacts_kind_ck', def: 'recommendations discovery' },
        { conname: 'cohort_text_jobs_stage_ck', def: 'recommendations discovery' },
      ],
    }); // constraints
    querySpy.mockResolvedValueOnce({ rows: [{ count: 1 }] }); // invocations table

    await assertTextJobSchema(mockSql);
    expect(querySpy).toHaveBeenCalledTimes(4);

    // Subsequent call must use cache with ZERO queries
    await assertTextJobSchema(mockSql);
    await ensureJourneyStageSchema(mockSql);
    expect(querySpy).toHaveBeenCalledTimes(4);

    // After reset, queries must be executed again
    resetSchemaReadinessCacheForTest();
    querySpy.mockResolvedValueOnce({ rows: [{ count: 3 }] });
    querySpy.mockResolvedValueOnce({ rows: [] });
    querySpy.mockResolvedValueOnce({
      rows: [
        { conname: 'cohort_text_artifacts_kind_ck', def: 'recommendations discovery' },
        { conname: 'cohort_text_jobs_stage_ck', def: 'recommendations discovery' },
      ],
    });
    querySpy.mockResolvedValueOnce({ rows: [{ count: 1 }] });

    await assertTextJobSchema(mockSql);
    expect(querySpy).toHaveBeenCalledTimes(8);
    resetSchemaReadinessCacheForTest();
  });
});
