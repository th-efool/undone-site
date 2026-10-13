import { createHash, randomUUID } from 'node:crypto';

export type CohortTextArtifactKind = 'source_raw' | 'understanding' | 'chunks' | 'analysis' | 'assembly';

/** Injected SQL port keeps this host-owned store usable with real PostgreSQL and isolated tests. */
export interface TextArtifactSql {
  query(sql: string, parameters: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface TextArtifactRef {
  id: string;
  workspaceId: string;
  sourceId: string | null;
  sourceVersion: number | null;
  kind: CohortTextArtifactKind;
  inputFingerprint: string;
  checksum: string;
  byteLength: number;
}

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const maxArtifactBytes = 2 * 1024 * 1024;

export async function putTextArtifact(sql: TextArtifactSql, input: {
  workspaceId: string;
  sourceId?: string;
  sourceVersion?: number;
  kind: CohortTextArtifactKind;
  inputFingerprint: string;
  bytes: Uint8Array;
}): Promise<TextArtifactRef> {
  const bytes = Buffer.from(input.bytes);
  if (bytes.length === 0 || bytes.length > maxArtifactBytes || (input.kind === 'source_raw' && bytes.length > 200_000)) throw new Error('ARTIFACT_SIZE_LIMIT');
  if ((input.sourceId === undefined) !== (input.sourceVersion === undefined) || (input.sourceVersion !== undefined && (!Number.isSafeInteger(input.sourceVersion) || input.sourceVersion < 0))) throw new Error('INVALID_SOURCE_IDENTITY');
  const ref: TextArtifactRef = {
    id: randomUUID(), workspaceId: input.workspaceId,
    sourceId: input.sourceId ?? null, sourceVersion: input.sourceVersion ?? null,
    kind: input.kind, inputFingerprint: input.inputFingerprint,
    checksum: hash(bytes), byteLength: bytes.length,
  };
  await sql.query(`INSERT INTO "cohort_text_artifacts"
    ("id", "workspaceId", "sourceId", "sourceVersion", "kind", "inputFingerprint", "checksum", "byteLength", "body")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [ref.id, ref.workspaceId, ref.sourceId, ref.sourceVersion, ref.kind, ref.inputFingerprint, ref.checksum, ref.byteLength, new Uint8Array(bytes)]);
  return ref;
}

export async function readTextArtifact(sql: TextArtifactSql, workspaceId: string, artifactId: string, expected?: Pick<TextArtifactRef, 'kind' | 'inputFingerprint' | 'checksum'>): Promise<{ ref: TextArtifactRef; bytes: Buffer }> {
  const result = await sql.query(`SELECT "id", "workspaceId", "sourceId", "sourceVersion", "kind", "inputFingerprint", "checksum", "byteLength", "body"
    FROM "cohort_text_artifacts" WHERE "workspaceId" = $1 AND "id" = $2`, [workspaceId, artifactId]);
  const row = result.rows[0];
  if (!row) throw new Error('ARTIFACT_NOT_FOUND');
  const bytes = Buffer.from(row.body as Uint8Array);
  const ref: TextArtifactRef = {
    id: String(row.id), workspaceId: String(row.workspaceId),
    sourceId: row.sourceId === null ? null : String(row.sourceId),
    sourceVersion: row.sourceVersion === null ? null : Number(row.sourceVersion),
    kind: row.kind as CohortTextArtifactKind,
    inputFingerprint: String(row.inputFingerprint),
    checksum: String(row.checksum), byteLength: Number(row.byteLength),
  };
  if (bytes.length === 0 || bytes.length > maxArtifactBytes || bytes.length !== ref.byteLength || hash(bytes) !== ref.checksum) throw new Error('ARTIFACT_INTEGRITY');
  if (expected && (expected.kind !== ref.kind || expected.inputFingerprint !== ref.inputFingerprint || expected.checksum !== ref.checksum)) throw new Error('ARTIFACT_CONTRACT_MISMATCH');
  return { ref, bytes };
}
