import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { putTextArtifact, readTextArtifact, type TextArtifactSql } from '../text-artifacts';

const migration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-s3-storage.sql', import.meta.url), 'utf8');

describe('owned retained text artifact store', () => {
  it('verifies bytes and hash on reads and never returns another workspace artifact', async () => {
    const db = new PGlite();
    const sql: TextArtifactSql = { query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters) };
    try {
      await db.exec('CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY)');
      await db.exec(migration);
      await db.exec(`INSERT INTO "interaction_workspaces" ("id") VALUES ('owner-a'), ('owner-b')`);
      const raw = Buffer.from('Quorums overlap.', 'utf8');
      const ref = await putTextArtifact(sql, { workspaceId: 'owner-a', sourceId: 'source-1', sourceVersion: 0, kind: 'source_raw', inputFingerprint: 'source-fingerprint', bytes: raw });
      expect(ref.byteLength).toBe(raw.length);
      expect((await readTextArtifact(sql, 'owner-a', ref.id, ref)).bytes.toString('utf8')).toBe('Quorums overlap.');
      await expect(readTextArtifact(sql, 'owner-b', ref.id)).rejects.toThrow('ARTIFACT_NOT_FOUND');
      await expect(readTextArtifact(sql, 'owner-a', ref.id, { ...ref, inputFingerprint: 'wrong' })).rejects.toThrow('ARTIFACT_CONTRACT_MISMATCH');
      await db.query(`UPDATE "cohort_text_artifacts" SET "body" = $1, "byteLength" = $2 WHERE "id" = $3`, [new Uint8Array(Buffer.from('Changed body only')), 'Changed body only'.length, ref.id]);
      await expect(readTextArtifact(sql, 'owner-a', ref.id)).rejects.toThrow('ARTIFACT_INTEGRITY');
    } finally {
      await db.close();
    }
  }, 30_000);

  it('rejects oversized and incoherent source identities before persistence', async () => {
    const neverSql: TextArtifactSql = { query: async () => { throw new Error('UNEXPECTED_SQL'); } };
    await expect(putTextArtifact(neverSql, { workspaceId: 'owner-a', kind: 'source_raw', inputFingerprint: 'f', bytes: new Uint8Array(2*1024*1024+1) })).rejects.toThrow('ARTIFACT_SIZE_LIMIT');
    await expect(putTextArtifact(neverSql, { workspaceId: 'owner-a', kind: 'analysis', sourceId: 'source-1', inputFingerprint: 'f', bytes: Buffer.from('ok') })).rejects.toThrow('INVALID_SOURCE_IDENTITY');
  });
});
