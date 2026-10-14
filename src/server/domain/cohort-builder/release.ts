import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { type CohortWorkspace, cohortWorkspaceSchema, cohortReleaseReceiptSchema } from '@/src/shared/cohort-builder/contracts';
import {
  type LearnerDeliveryPayload,
  projectCohortToLearnerDelivery,
  deliveryCohortId,
} from '@/src/shared/cohort-builder/delivery';

export const releaseReceiptSchema = cohortReleaseReceiptSchema;
export type ReleaseReceipt = z.infer<typeof releaseReceiptSchema>;

export interface CohortReadinessChecks {
  intentValid: boolean;
  lessonsValid: boolean;
  sourcesReady: boolean;
  evidenceValid: boolean;
  processingComplete: boolean;
  rightsValid: boolean;
}

export interface CohortReadinessReport {
  ready: boolean;
  mode: 'private_activation' | 'public_publish';
  blockers: string[];
  warnings: string[];
  checks: CohortReadinessChecks;
}

export class CohortReadinessError extends Error {
  constructor(public readonly report: CohortReadinessReport) {
    super(`COHORT_NOT_READY_FOR_RELEASE: ${report.blockers.join('; ')}`);
    this.name = 'CohortReadinessError';
  }
}

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
 * Validates deterministic workspace readiness before freeze or release.
 */
export function validateCohortReadiness(
  workspaceInput: CohortWorkspace,
  mode: 'private_activation' | 'public_publish'
): CohortReadinessReport {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const parsed = cohortWorkspaceSchema.safeParse(workspaceInput);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      // Only include generic schema errors for fields not handled by specific domain checks below
      if (!['intent', 'title', 'dailyMinutes', 'lessons'].includes(String(field))) {
        blockers.push(`${issue.path.join('.') || 'workspace'}: ${issue.message}`);
      }
    }
  }

  const workspace = parsed.success ? parsed.data : workspaceInput;

  // 1. Intent validation
  const hasIntent = Boolean(workspace.intent?.trim());
  const hasTitle = Boolean(workspace.title?.trim());
  const hasValidPacing = typeof workspace.dailyMinutes === 'number' && workspace.dailyMinutes >= 1 && workspace.dailyMinutes <= 1_440;

  if (!hasIntent) blockers.push('Workspace intent is missing or empty.');
  if (!hasTitle) blockers.push('Workspace title is missing or empty.');
  if (!hasValidPacing) blockers.push('Daily learning minutes must be between 1 and 1440.');

  // 2. Lessons validation
  const lessons = Array.isArray(workspace.lessons) ? workspace.lessons : [];
  const hasLessons = lessons.length > 0;
  if (!hasLessons) {
    blockers.push('Workspace has no lessons in its curriculum.');
  }

  const emptyLessons = lessons.filter(l => !l.title?.trim() || !l.objective?.trim());
  if (emptyLessons.length > 0) {
    blockers.push(`${emptyLessons.length} lesson(s) have missing titles or objectives.`);
  }

  // 3. Evidence & Chunk Grounding validation
  const chunks = Array.isArray(workspace.chunks) ? workspace.chunks : [];
  const sources = Array.isArray(workspace.sources) ? workspace.sources : [];
  const chunkIds = new Set(chunks.map(c => c.id));
  const sourceIds = new Set(sources.map(s => s.id));

  const lessonsWithMissingChunks = lessons.filter(l =>
    Array.isArray(l.sourceChunkIds) && l.sourceChunkIds.some(cid => !chunkIds.has(cid))
  );
  if (lessonsWithMissingChunks.length > 0) {
    blockers.push(`${lessonsWithMissingChunks.length} lesson(s) reference non-existent evidence chunks.`);
  }

  const orphanedLessons = lessons.filter(l => l.evidenceStatus === 'orphaned');
  if (orphanedLessons.length > 0) {
    if (mode === 'public_publish') {
      blockers.push(`${orphanedLessons.length} lesson(s) have orphaned evidence. Resolve or replace orphaned lessons before public release.`);
    } else {
      warnings.push(`${orphanedLessons.length} lesson(s) have orphaned evidence. Review before publication.`);
    }
  }

  // Chunks pointing to non-existent sources
  const invalidChunks = chunks.filter(c => !sourceIds.has(c.sourceId));
  if (invalidChunks.length > 0) {
    blockers.push(`${invalidChunks.length} chunk(s) reference non-existent sources.`);
  }

  // 4. Processing status validation
  const processing = workspace.processing ?? { status: 'idle' };
  const isProcessingFailed = processing.status === 'failed';
  const isProcessingActive = processing.status === 'processing' || processing.status === 'queued';

  if (isProcessingFailed) {
    blockers.push(`Background source processing has failed: ${processing.error ?? 'Unknown error'}. Retry or cancel before release.`);
  }
  if (isProcessingActive) {
    blockers.push('Source processing jobs are currently active. Wait for completion before releasing.');
  }

  const unreadySources = sources.filter(s => s.state !== 'ready');
  if (unreadySources.length > 0) {
    blockers.push(`${unreadySources.length} source(s) are not in 'ready' state (status: ${unreadySources.map(s => s.state).join(', ')}).`);
  }

  // 5. Rights validation for Public Publish
  let rightsValid = true;
  if (mode === 'public_publish') {
    if (orphanedLessons.length > 0) {
      rightsValid = false;
    }
    if (sources.some(s => s.isRestricted)) {
      blockers.push('Private, connector, or restricted sources cannot be published publicly without an approved redistribution policy.');
      rightsValid = false;
    }
  }

  const checks: CohortReadinessChecks = {
    intentValid: hasIntent && hasTitle && hasValidPacing,
    lessonsValid: hasLessons && emptyLessons.length === 0,
    sourcesReady: unreadySources.length === 0,
    evidenceValid: lessonsWithMissingChunks.length === 0 && invalidChunks.length === 0 && (mode === 'private_activation' || orphanedLessons.length === 0),
    processingComplete: !isProcessingFailed && !isProcessingActive,
    rightsValid,
  };

  const ready = blockers.length === 0 && Object.values(checks).every(Boolean);

  return {
    ready,
    mode,
    blockers,
    warnings,
    checks,
  };
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
    title: workspace.title.trim(),
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
