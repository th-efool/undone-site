import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  assertSourceSchema,
  resetSourceSchemaVerificationForTest,
  sourceCapability,
  validateSourceAction,
  PDF_SOURCE_BYTES,
} from '../source-policy';
import type { TextArtifactSql } from '../text-artifacts';

describe('source-policy and schema constraint verification', () => {
  beforeEach(() => {
    resetSourceSchemaVerificationForTest();
  });

  afterEach(() => {
    resetSourceSchemaVerificationForTest();
    vi.restoreAllMocks();
  });

  it('queries pg_constraint on the first call and caches verification for subsequent calls', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { definition: "CHECK (stage IN ('acquisition', 'extraction', 'chunking'))" },
        { definition: "CHECK (kind IN ('source_input', 'source_raw', 'extraction'))" },
      ],
    });
    const sql: TextArtifactSql = { query };

    // First call: executes query and caches
    await assertSourceSchema(sql);
    expect(query).toHaveBeenCalledTimes(1);

    // Subsequent calls: should immediately return without querying DB again
    await assertSourceSchema(sql);
    await assertSourceSchema(sql);
    await assertSourceSchema(sql);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('deduplicates simultaneous in-flight queries', async () => {
    let resolveQuery: (value: unknown) => void = () => {};
    const queryPromise = new Promise(resolve => {
      resolveQuery = resolve;
    });
    const query = vi.fn().mockImplementation(() => queryPromise);
    const sql: TextArtifactSql = { query };

    // Fire 3 simultaneous calls before query resolves
    const p1 = assertSourceSchema(sql);
    const p2 = assertSourceSchema(sql);
    const p3 = assertSourceSchema(sql);

    expect(query).toHaveBeenCalledTimes(1);

    resolveQuery({
      rows: [
        { definition: "CHECK (stage IN ('acquisition', 'extraction', 'chunking'))" },
        { definition: "CHECK (kind IN ('source_input', 'source_raw', 'extraction'))" },
      ],
    });

    await Promise.all([p1, p2, p3]);

    // Fourth call after resolution: still cached
    await assertSourceSchema(sql);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('throws S4B_SCHEMA_NOT_INSTALLED when schema is invalid and allows retrying after failure', async () => {
    const invalidQuery = vi.fn().mockResolvedValue({
      rows: [{ definition: 'CHECK (invalid)' }],
    });
    const sql: TextArtifactSql = { query: invalidQuery };

    await expect(assertSourceSchema(sql)).rejects.toThrow('S4B_SCHEMA_NOT_INSTALLED');
    expect(invalidQuery).toHaveBeenCalledTimes(1);

    // Because it threw, sourceSchemaVerified should NOT be set, so the next attempt will query again
    const validQuery = vi.fn().mockResolvedValue({
      rows: [
        { definition: "CHECK (stage IN ('acquisition', 'extraction', 'chunking'))" },
        { definition: "CHECK (kind IN ('source_input', 'source_raw', 'extraction'))" },
      ],
    });
    const validSql: TextArtifactSql = { query: validQuery };

    await assertSourceSchema(validSql);
    expect(validQuery).toHaveBeenCalledTimes(1);

    // Now cached
    await assertSourceSchema(validSql);
    expect(validQuery).toHaveBeenCalledTimes(1);
  });

  it('clears verification cache when resetSourceSchemaVerificationForTest is called', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { definition: "CHECK (stage IN ('extraction'))" },
        { definition: "CHECK (kind IN ('source_input', 'extraction'))" },
      ],
    });
    const sql: TextArtifactSql = { query };

    await assertSourceSchema(sql);
    expect(query).toHaveBeenCalledTimes(1);

    resetSourceSchemaVerificationForTest();

    await assertSourceSchema(sql);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('correctly reports source capabilities according to environment variables', () => {
    const origPdf = process.env.INTERACTION_PDF_ENABLED;
    const origWeb = process.env.INTERACTION_WEB_ENABLED;
    const origYt = process.env.INTERACTION_YOUTUBE_ENABLED;
    try {
      process.env.INTERACTION_PDF_ENABLED = '1';
      expect(sourceCapability('pdf')).toBe(true);
      process.env.INTERACTION_PDF_ENABLED = '0';
      expect(sourceCapability('pdf')).toBe(false);

      process.env.INTERACTION_WEB_ENABLED = '1';
      expect(sourceCapability('web')).toBe(true);
      process.env.INTERACTION_WEB_ENABLED = '0';
      expect(sourceCapability('web')).toBe(false);

      process.env.INTERACTION_YOUTUBE_ENABLED = '1';
      expect(sourceCapability('youtube')).toBe(true);
      process.env.INTERACTION_YOUTUBE_ENABLED = '0';
      expect(sourceCapability('youtube')).toBe(false);
    } finally {
      process.env.INTERACTION_PDF_ENABLED = origPdf;
      process.env.INTERACTION_WEB_ENABLED = origWeb;
      process.env.INTERACTION_YOUTUBE_ENABLED = origYt;
    }
  });
});
