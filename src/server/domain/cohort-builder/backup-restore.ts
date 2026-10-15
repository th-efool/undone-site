import 'server-only';
import { createHash } from 'node:crypto';
import type { TextArtifactSql } from './text-artifacts';
import type { WorkspaceExportBundle } from './workspace-export';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

export interface RestoreValidationResult {
  valid: boolean;
  integrityErrors: string[];
  danglingArtifactIds: string[];
  incompletePublicBlocked: boolean;
}

export interface RestoreWorkspaceResult {
  restoredWorkspaceId: string;
  restoredRevision: number;
  restoredMessages: number;
  restoredEvents: number;
  restoredArtifacts: number;
  restoredJobs: number;
  recoveredRunningJobs: number;
  publicBlocked: boolean;
}

/**
 * Validates a backup bundle before restoring.
 * Checks artifact checksums, detects dangling references, and checks public release safety.
 */
export function validateBackupBundle(bundle: WorkspaceExportBundle): RestoreValidationResult {
  const integrityErrors: string[] = [];
  const danglingArtifactIds: string[] = [];
  const availableArtifactIds = new Set<string>();

  // 1. Validate artifact checksums & byte lengths
  for (const art of bundle.artifacts) {
    if (!art.bodyBase64) {
      integrityErrors.push(`Artifact ${art.id} is missing body content.`);
      continue;
    }
    const buf = Buffer.from(art.bodyBase64, 'base64');
    if (buf.length !== art.byteLength) {
      integrityErrors.push(
        `Artifact ${art.id} byte length mismatch (expected ${art.byteLength}, got ${buf.length}).`
      );
    }
    const sha = createHash('sha256').update(buf).digest('hex');
    if (sha !== art.checksum) {
      integrityErrors.push(
        `Artifact ${art.id} checksum mismatch (expected ${art.checksum}, computed ${sha}).`
      );
    }
    availableArtifactIds.add(art.id);
  }

  // 2. Detect dangling references in jobs
  for (const job of bundle.jobs) {
    if (job.resultArtifactId && !availableArtifactIds.has(job.resultArtifactId)) {
      danglingArtifactIds.push(job.resultArtifactId);
    }
  }

  // 3. Detect dangling references in sources
  const snapshot = bundle.workspace.snapshot as CohortWorkspace | undefined;
  if (snapshot && Array.isArray(snapshot.sources)) {
    for (const src of snapshot.sources) {
      if (src.retainedInputId && !availableArtifactIds.has(src.retainedInputId)) {
        danglingArtifactIds.push(src.retainedInputId);
      }
      if (src.input && 'uploadId' in src.input && src.input.uploadId && !availableArtifactIds.has(src.input.uploadId)) {
        danglingArtifactIds.push(src.input.uploadId);
      }
    }
  }

  // 4. Incomplete restored content cannot become public
  let incompletePublicBlocked = false;
  if (danglingArtifactIds.length > 0 || integrityErrors.length > 0) {
    if (snapshot?.release?.mode === 'public_publish') {
      incompletePublicBlocked = true;
    }
  }

  return {
    valid: integrityErrors.length === 0,
    integrityErrors,
    danglingArtifactIds: Array.from(new Set(danglingArtifactIds)),
    incompletePublicBlocked,
  };
}

/**
 * Restores a workspace from a verified backup bundle into an isolated PostgreSQL instance.
 * - Detects dangling/missing references.
 * - Recovers interrupted in-flight work (resets 'running' jobs to 'queued').
 * - Blocks incomplete restored content from becoming public.
 */
export async function restoreWorkspaceFromBundle(
  sql: TextArtifactSql,
  bundle: WorkspaceExportBundle,
  options?: {
    overrideOwnerId?: string;
    failOnDangling?: boolean;
    now?: Date;
  }
): Promise<RestoreWorkspaceResult> {
  const now = options?.now ?? new Date();
  const validation = validateBackupBundle(bundle);

  if (!validation.valid) {
    throw new Error(
      `BACKUP_INTEGRITY_FAILURE: Cannot restore corrupted bundle: ${validation.integrityErrors.join(', ')}`
    );
  }

  if (validation.danglingArtifactIds.length > 0 && options?.failOnDangling) {
    throw new Error(
      `DANGLING_ARTIFACTS_DETECTED: Restored bundle references missing artifacts: ${validation.danglingArtifactIds.join(', ')}`
    );
  }

  const ownerId = options?.overrideOwnerId ?? bundle.workspace.ownerId;
  const ws = bundle.workspace;
  let snapshot = ws.snapshot as CohortWorkspace;

  // If dangling artifacts were detected, incomplete restored content cannot become public!
  let publicBlocked = false;
  if (validation.danglingArtifactIds.length > 0 && snapshot.release?.mode === 'public_publish') {
    publicBlocked = true;
    snapshot = {
      ...snapshot,
      processing: {
        ...snapshot.processing,
        error: `RESTORE_INTEGRITY_WARNING: Missing artifact references detected: ${validation.danglingArtifactIds.join(', ')}. Public release blocked.`,
      },
      release: {
        ...snapshot.release,
        status: 'draft', // Demote from public publication to protected draft
      },
    };
  }

  // 1. Insert Workspace
  await sql.query(
    `INSERT INTO "interaction_workspaces"
       ("id", "ownerId", "domainId", "domainVersion", "snapshot", "revision", "sequence", "contextEpoch", "lifecycle", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      ws.id,
      ownerId,
      ws.domainId,
      ws.domainVersion,
      JSON.stringify(snapshot),
      ws.revision,
      ws.sequence,
      ws.contextEpoch,
      ws.lifecycle,
      new Date(ws.createdAt),
      now,
    ]
  );

  // 2. Insert Artifacts
  let restoredArtifacts = 0;
  for (const art of bundle.artifacts) {
    const buf = Buffer.from(art.bodyBase64, 'base64');
    await sql.query(
      `INSERT INTO "cohort_text_artifacts"
         ("id", "workspaceId", "sourceId", "sourceVersion", "kind", "inputFingerprint", "checksum", "byteLength", "body", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        art.id,
        ws.id,
        art.sourceId,
        art.sourceVersion,
        art.kind,
        art.inputFingerprint,
        art.checksum,
        art.byteLength,
        new Uint8Array(buf),
        now,
      ]
    );
    restoredArtifacts++;
  }

  // 3. Insert and Recover Jobs (running jobs reset to queued)
  let restoredJobs = 0;
  let recoveredRunningJobs = 0;
  for (const job of bundle.jobs) {
    let status = job.status;
    let leaseOwner: string | null = null;
    let leaseToken: string | null = null;
    let leaseUntil: Date | null = null;

    if (status === 'running') {
      // Safe bounded recovery of interrupted work: reset running to queued without stale lease
      status = 'queued';
      recoveredRunningJobs++;
    }

    await sql.query(
      `INSERT INTO "cohort_text_jobs"
         ("id", "workspaceId", "jobKey", "stage", "dependencyFingerprint", "status", "attempts", "resultArtifactId", "leaseOwner", "leaseToken", "leaseUntil", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        job.id,
        ws.id,
        job.jobKey,
        job.stage,
        'restored-fingerprint',
        status,
        job.attempts,
        job.resultArtifactId,
        leaseOwner,
        leaseToken,
        leaseUntil,
        now,
        now,
      ]
    );
    restoredJobs++;
  }

  // 4. Insert Messages
  let restoredMessages = 0;
  for (const msg of bundle.transcript) {
    await sql.query(
      `INSERT INTO "interaction_messages"
         ("id", "workspaceId", "role", "parts", "sequence", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        msg.id,
        ws.id,
        msg.role,
        JSON.stringify(msg.parts),
        msg.sequence,
        new Date(msg.createdAt),
      ]
    );
    restoredMessages++;
  }

  // 5. Insert Events
  let restoredEvents = 0;
  for (const evt of bundle.events) {
    await sql.query(
      `INSERT INTO "interaction_events"
         ("id", "workspaceId", "sequence", "type", "revision", "payload", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        evt.id,
        ws.id,
        evt.sequence,
        evt.type,
        evt.revision,
        JSON.stringify(evt.payload),
        new Date(evt.createdAt),
      ]
    );
    restoredEvents++;
  }

  return {
    restoredWorkspaceId: ws.id,
    restoredRevision: ws.revision,
    restoredMessages,
    restoredEvents,
    restoredArtifacts,
    restoredJobs,
    recoveredRunningJobs,
    publicBlocked,
  };
}
