import 'server-only';
import type { TextArtifactSql } from './text-artifacts';

export interface WorkspaceExportBundle {
  version: 1;
  exportedAt: string;
  workspace: {
    id: string;
    ownerId: string;
    domainId: string;
    domainVersion: number;
    snapshot: unknown;
    revision: number;
    sequence: number;
    contextEpoch: number;
    lifecycle: string;
    createdAt: string;
    updatedAt: string;
  };
  transcript: Array<{
    id: string;
    role: string;
    parts: unknown;
    sequence: number;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    sequence: number;
    type: string;
    revision: number | null;
    payload: unknown;
    createdAt: string;
  }>;
  artifacts: Array<{
    id: string;
    kind: string;
    sourceId: string | null;
    sourceVersion: number | null;
    inputFingerprint: string;
    checksum: string;
    byteLength: number;
    bodyBase64: string;
  }>;
  jobs: Array<{
    id: string;
    jobKey: string;
    stage: string;
    status: string;
    attempts: number;
    resultArtifactId: string | null;
  }>;
  releaseReceipts: unknown[];
}

/**
 * Exports a workspace into a portable, ownership-verified bundle.
 * Tenant-isolated: only the workspace owner can export their workspace data.
 */
export async function exportWorkspaceData(
  sql: TextArtifactSql,
  params: {
    workspaceId: string;
    ownerId: string;
    includeArtifactBodies?: boolean;
  }
): Promise<WorkspaceExportBundle> {
  const includeBodies = params.includeArtifactBodies ?? true;

  // 1. Verify workspace exists and check ownership
  const wsRes = await sql.query(
    `SELECT "id", "ownerId", "domainId", "domainVersion", "snapshot", "revision", "sequence", "contextEpoch", "lifecycle", "createdAt", "updatedAt"
     FROM "interaction_workspaces"
     WHERE "id" = $1`,
    [params.workspaceId]
  );

  const wsRow = wsRes.rows[0];
  if (!wsRow) {
    throw new Error('WORKSPACE_NOT_FOUND: Workspace does not exist.');
  }
  if (wsRow.ownerId !== params.ownerId) {
    throw new Error('UNAUTHORIZED_OWNER: Cannot export workspace owned by another user.');
  }

  // 2. Fetch transcript messages ordered by sequence
  const msgRes = await sql.query(
    `SELECT "id", "role", "parts", "sequence", "createdAt"
     FROM "interaction_messages"
     WHERE "workspaceId" = $1
     ORDER BY "sequence" ASC`,
    [params.workspaceId]
  );

  // 3. Fetch canonical events ordered by sequence
  const evtRes = await sql.query(
    `SELECT "id", "sequence", "type", "revision", "payload", "createdAt"
     FROM "interaction_events"
     WHERE "workspaceId" = $1
     ORDER BY "sequence" ASC`,
    [params.workspaceId]
  );

  // 4. Fetch artifacts
  const artRes = await sql.query(
    `SELECT "id", "kind", "sourceId", "sourceVersion", "inputFingerprint", "checksum", "byteLength", "body"
     FROM "cohort_text_artifacts"
     WHERE "workspaceId" = $1`,
    [params.workspaceId]
  );

  // 5. Fetch jobs
  const jobRes = await sql.query(
    `SELECT "id", "jobKey", "stage", "status", "attempts", "resultArtifactId"
     FROM "cohort_text_jobs"
     WHERE "workspaceId" = $1`,
    [params.workspaceId]
  );

  // 6. Fetch release effects
  const relRes = await sql.query(
    `SELECT "effectKey", "mode", "cohortId", "state", "receipt", "createdAt"
     FROM "interaction_effects"
     WHERE "workspaceId" = $1`,
    [params.workspaceId]
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: {
      id: String(wsRow.id),
      ownerId: String(wsRow.ownerId),
      domainId: String(wsRow.domainId),
      domainVersion: Number(wsRow.domainVersion),
      snapshot: typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot,
      revision: Number(wsRow.revision),
      sequence: Number(wsRow.sequence),
      contextEpoch: Number(wsRow.contextEpoch),
      lifecycle: String(wsRow.lifecycle),
      createdAt: wsRow.createdAt instanceof Date ? wsRow.createdAt.toISOString() : String(wsRow.createdAt),
      updatedAt: wsRow.updatedAt instanceof Date ? wsRow.updatedAt.toISOString() : String(wsRow.updatedAt),
    },
    transcript: msgRes.rows.map(r => ({
      id: String(r.id),
      role: String(r.role),
      parts: typeof r.parts === 'string' ? JSON.parse(r.parts) : r.parts,
      sequence: Number(r.sequence),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
    events: evtRes.rows.map(r => ({
      id: String(r.id),
      sequence: Number(r.sequence),
      type: String(r.type),
      revision: r.revision === null ? null : Number(r.revision),
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
    artifacts: artRes.rows.map(r => {
      const bodyBuf = Buffer.from(r.body as Uint8Array);
      return {
        id: String(r.id),
        kind: String(r.kind),
        sourceId: r.sourceId === null ? null : String(r.sourceId),
        sourceVersion: r.sourceVersion === null ? null : Number(r.sourceVersion),
        inputFingerprint: String(r.inputFingerprint),
        checksum: String(r.checksum),
        byteLength: Number(r.byteLength),
        bodyBase64: includeBodies ? bodyBuf.toString('base64') : '',
      };
    }),
    jobs: jobRes.rows.map(r => ({
      id: String(r.id),
      jobKey: String(r.jobKey),
      stage: String(r.stage),
      status: String(r.status),
      attempts: Number(r.attempts),
      resultArtifactId: r.resultArtifactId === null ? null : String(r.resultArtifactId),
    })),
    releaseReceipts: relRes.rows.map(r => ({
      effectKey: String(r.effectKey),
      mode: String(r.mode),
      cohortId: String(r.cohortId),
      state: String(r.state),
      receipt: typeof r.receipt === 'string' ? JSON.parse(r.receipt) : r.receipt,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
  };
}
