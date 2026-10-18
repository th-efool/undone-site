import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { type CohortWorkspace, cohortWorkspaceSchema, cohortReleaseReceiptSchema } from '@/src/shared/cohort-builder/contracts';
import { deriveCohortTitle, deriveCohortDescription } from '@/src/shared/cohort-builder/cohort-metadata';
import {
  type LearnerDeliveryPayload,
  projectCohortToLearnerDelivery,
  deliveryCohortId,
} from '@/src/shared/cohort-builder/delivery';

export const releaseReceiptSchema = cohortReleaseReceiptSchema;
export type ReleaseReceipt = z.infer<typeof releaseReceiptSchema>;

import {
  type CohortReadinessChecks,
  type CohortReadinessReport,
  CohortReadinessError,
  validateCohortReadiness,
} from '@/src/shared/cohort-builder/readiness';

export {
  type CohortReadinessChecks,
  type CohortReadinessReport,
  CohortReadinessError,
  validateCohortReadiness,
};

export interface FreezeOptions {
  workspaceId: string;
  workspaceRevision: number;
  mode: 'private_activation' | 'public_publish';
  cohortId?: string;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  language?: string;
}

export interface FrozenCohortCandidate {
  snapshotHash: string;
  cohortId: string;
  mode: 'private_activation' | 'public_publish';
  workspaceId: string;
  workspaceRevision: number;
  frozenAt: string;
  delivery: LearnerDeliveryPayload;
  readiness: CohortReadinessReport;
}

export interface ReleaseEffectRecord {
  effectKey: string;
  workspaceId: string;
  contentHash: string;
  mode: 'private_activation' | 'public_publish';
  cohortId: string;
  state: 'pending' | 'committed' | 'failed';
  receipt?: ReleaseReceipt;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseEffectStore {
  get(effectKey: string): Promise<ReleaseEffectRecord | null>;
  recordPending(record: Omit<ReleaseEffectRecord, 'state' | 'receipt' | 'updatedAt'>): Promise<void>;
  commitReceipt(effectKey: string, receipt: ReleaseReceipt): Promise<void>;
}



/**
 * Derives a deterministic SHA-256 hash representing the candidate workspace content.
 */
export function deriveCandidateSnapshotHash(
  workspace: CohortWorkspace,
  options: { workspaceId: string; workspaceRevision?: number; mode?: 'private_activation' | 'public_publish' }
): string {
  const normalized = {
    schemaVersion: 1,
    workspaceId: options.workspaceId,
    title: deriveCohortTitle(workspace),
    description: deriveCohortDescription(workspace),
    intent: workspace.intent.trim(),
    audience: workspace.audience.trim(),
    dailyMinutes: workspace.dailyMinutes,
    lessons: workspace.lessons.map(l => ({
      id: l.id,
      title: l.title.trim(),
      objective: l.objective.trim(),
      sourceChunkIds: [...l.sourceChunkIds].sort(),
      pinned: l.pinned,
      manualOverride: l.manualOverride ?? false,
      evidenceStatus: l.evidenceStatus ?? 'valid',
    })),
    sources: workspace.sources.map(s => ({
      id: s.id,
      version: s.version,
      label: s.label.trim(),
      checksum: s.checksum,
      provenance: s.provenance,
    })),
    chunks: workspace.chunks.map(c => ({
      id: c.id,
      sourceId: c.sourceId,
      start: c.start,
      end: c.end,
      checksum: c.checksum,
    })),
  };

  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

/**
 * Derives the unique, idempotent effect key for an interaction release.
 */
export function deriveReleaseEffectKey(
  workspaceId: string,
  mode: 'private_activation' | 'public_publish',
  operationId?: string
): string {
  const parts = ['cohort-release-effect-v1', workspaceId, mode];
  if (operationId) parts.push(operationId);
  return createHash('sha256')
    .update(parts.join(':'))
    .digest('hex');
}

/**
 * Freezes a validated cohort candidate and produces the immutable delivery DTO.
 */
export function freezeCohortCandidate(
  workspaceInput: CohortWorkspace,
  options: FreezeOptions
): FrozenCohortCandidate {
  const workspace = cohortWorkspaceSchema.parse(workspaceInput);
  const readiness = validateCohortReadiness(workspace, options.mode);

  if (!readiness.ready) {
    throw new CohortReadinessError(readiness);
  }

  const snapshotHash = deriveCandidateSnapshotHash(workspace, {
    workspaceId: options.workspaceId,
    workspaceRevision: options.workspaceRevision,
    mode: options.mode,
  });

  const cohortId = options.cohortId ?? workspace.release?.cohortId ?? deliveryCohortId(options.workspaceId, snapshotHash);

  const delivery = projectCohortToLearnerDelivery(workspace, {
    workspaceId: options.workspaceId,
    workspaceRevision: options.workspaceRevision,
    cohortId,
    contentHash: snapshotHash,
    mode: options.mode,
    difficulty: options.difficulty,
    language: options.language,
  });

  return {
    snapshotHash,
    cohortId,
    mode: options.mode,
    workspaceId: options.workspaceId,
    workspaceRevision: options.workspaceRevision,
    frozenAt: new Date().toISOString(),
    delivery,
    readiness,
  };
}

/**
 * Creates the validated, crash-safe release receipt.
 */
export function createReleaseReceipt(options: {
  effectKey: string;
  cohortId: string;
  workspaceId: string;
  contentHash: string;
  mode: 'private_activation' | 'public_publish';
  releasedAt?: string;
}): ReleaseReceipt {
  const destinationUrl = options.mode === 'private_activation'
    ? `/play?cohort=${options.cohortId}`
    : `/cohort/${options.cohortId}`;

  return releaseReceiptSchema.parse({
    effectKey: options.effectKey,
    cohortId: options.cohortId,
    workspaceId: options.workspaceId,
    contentHash: options.contentHash,
    mode: options.mode,
    releasedAt: options.releasedAt ?? new Date().toISOString(),
    destinationUrl,
  });
}

/**
 * In-memory test double for ReleaseEffectStore.
 */
export class MemoryReleaseEffectStore implements ReleaseEffectStore {
  private readonly records = new Map<string, ReleaseEffectRecord>();

  async get(effectKey: string): Promise<ReleaseEffectRecord | null> {
    const record = this.records.get(effectKey);
    return record ? structuredClone(record) : null;
  }

  async recordPending(record: Omit<ReleaseEffectRecord, 'state' | 'receipt' | 'updatedAt'>): Promise<void> {
    const existing = this.records.get(record.effectKey);
    if (existing && existing.state === 'committed') {
      return;
    }
    const now = new Date().toISOString();
    this.records.set(record.effectKey, {
      ...record,
      state: 'pending',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async commitReceipt(effectKey: string, receipt: ReleaseReceipt): Promise<void> {
    const existing = this.records.get(effectKey);
    const now = new Date().toISOString();
    this.records.set(effectKey, {
      effectKey,
      workspaceId: receipt.workspaceId,
      contentHash: receipt.contentHash,
      mode: receipt.mode,
      cohortId: receipt.cohortId,
      state: 'committed',
      receipt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }
}

/**
 * Executes a release with idempotency and crash-safe effect receipt guarantees.
 */
export async function executeIdempotentRelease(
  store: ReleaseEffectStore,
  frozen: FrozenCohortCandidate,
  materializer: (candidate: FrozenCohortCandidate) => Promise<void>,
  options?: { operationId?: string }
): Promise<ReleaseReceipt> {
  const effectKey = deriveReleaseEffectKey(frozen.workspaceId, frozen.mode, options?.operationId);

  const existing = await store.get(effectKey);
  if (existing?.state === 'committed' && existing.receipt) {
    if (existing.contentHash !== frozen.snapshotHash) {
      throw new Error('EFFECT_HASH_MISMATCH: Stored effect key corresponds to different frozen content.');
    }
    return existing.receipt;
  }

  await store.recordPending({
    effectKey,
    workspaceId: frozen.workspaceId,
    contentHash: frozen.snapshotHash,
    mode: frozen.mode,
    cohortId: frozen.cohortId,
    createdAt: new Date().toISOString(),
  });

  await materializer(frozen);

  const receipt = createReleaseReceipt({
    effectKey,
    cohortId: frozen.cohortId,
    workspaceId: frozen.workspaceId,
    contentHash: frozen.snapshotHash,
    mode: frozen.mode,
  });

  await store.commitReceipt(effectKey, receipt);

  return receipt;
}
