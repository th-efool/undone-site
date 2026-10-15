import 'server-only';

export interface CohortRetentionPolicy {
  /**
   * Retention for durable conversation transcripts (messages and parts).
   * Durable transcript must outlive transient replay retention according to product policy.
   */
  transcriptRetentionDays: number;

  /**
   * Retention for transient SSE/replay events (interaction_events).
   * Used for streaming reconnection cursors.
   */
  eventReplayRetentionDays: number;

  /**
   * Retention for draft artifacts belonging to unreleased inactive workspaces.
   */
  draftArtifactRetentionDays: number;

  /**
   * Retention for orphaned artifacts (not referenced in workspace snapshot or jobs).
   */
  orphanArtifactRetentionDays: number;

  /**
   * Whether released learner cohort evidence remains permanently pinned.
   * In canonical architecture, this MUST be true.
   */
  releasedArtifactPinned: boolean;

  /**
   * Grace period in days between user-requested tombstone / access revocation and physical purge.
   */
  tombstoneGraceDays: number;

  /**
   * Duration in milliseconds for an active reader lease to protect artifacts during reading/streaming.
   */
  activeReadLeaseMs: number;

  /**
   * Duration in milliseconds for a pending release pin to protect artifacts during validation and freeze.
   */
  pendingReleasePinMs: number;

  /**
   * Bounded batch size for database cleanup sweeps.
   */
  batchLimit: number;
}

export class CohortRetentionPolicyError extends Error {
  constructor(public readonly errors: string[]) {
    super(`INVALID_RETENTION_POLICY: ${errors.join('; ')}`);
    this.name = 'CohortRetentionPolicyError';
  }
}

export const DEFAULT_PRODUCTION_RETENTION_POLICY: CohortRetentionPolicy = {
  transcriptRetentionDays: 90,
  eventReplayRetentionDays: 7,
  draftArtifactRetentionDays: 30,
  orphanArtifactRetentionDays: 3,
  releasedArtifactPinned: true,
  tombstoneGraceDays: 7,
  activeReadLeaseMs: 60_000,
  pendingReleasePinMs: 300_000,
  batchLimit: 50,
};

export const TEST_RETENTION_POLICY: CohortRetentionPolicy = {
  transcriptRetentionDays: 7,
  eventReplayRetentionDays: 1,
  draftArtifactRetentionDays: 3,
  orphanArtifactRetentionDays: 1,
  releasedArtifactPinned: true,
  tombstoneGraceDays: 1,
  activeReadLeaseMs: 5_000,
  pendingReleasePinMs: 10_000,
  batchLimit: 10,
};

/**
 * Validates retention policy against production requirements.
 * Rejects missing or nonsensical values (fails closed on production startup).
 */
export function validateCohortRetentionPolicy(
  policy: Partial<CohortRetentionPolicy> | null | undefined,
  isProduction: boolean
): CohortRetentionPolicy {
  const errors: string[] = [];

  if (!policy) {
    throw new CohortRetentionPolicyError(['Retention policy is missing or null.']);
  }

  // 1. Separate policies check
  if (typeof policy.transcriptRetentionDays !== 'number' || !Number.isFinite(policy.transcriptRetentionDays) || policy.transcriptRetentionDays <= 0) {
    errors.push('transcriptRetentionDays must be a positive finite number.');
  }

  if (typeof policy.eventReplayRetentionDays !== 'number' || !Number.isFinite(policy.eventReplayRetentionDays) || policy.eventReplayRetentionDays <= 0) {
    errors.push('eventReplayRetentionDays must be a positive finite number.');
  }

  if (typeof policy.draftArtifactRetentionDays !== 'number' || !Number.isFinite(policy.draftArtifactRetentionDays) || policy.draftArtifactRetentionDays <= 0) {
    errors.push('draftArtifactRetentionDays must be a positive finite number.');
  }

  if (typeof policy.orphanArtifactRetentionDays !== 'number' || !Number.isFinite(policy.orphanArtifactRetentionDays) || policy.orphanArtifactRetentionDays <= 0) {
    errors.push('orphanArtifactRetentionDays must be a positive finite number.');
  }

  if (policy.releasedArtifactPinned !== true) {
    errors.push('releasedArtifactPinned must be true (released artifacts must remain permanently pinned).');
  }

  if (typeof policy.tombstoneGraceDays !== 'number' || !Number.isFinite(policy.tombstoneGraceDays) || policy.tombstoneGraceDays <= 0) {
    errors.push('tombstoneGraceDays must be a positive finite number.');
  }

  if (typeof policy.activeReadLeaseMs !== 'number' || !Number.isFinite(policy.activeReadLeaseMs) || policy.activeReadLeaseMs <= 0) {
    errors.push('activeReadLeaseMs must be a positive number of milliseconds.');
  }

  if (typeof policy.pendingReleasePinMs !== 'number' || !Number.isFinite(policy.pendingReleasePinMs) || policy.pendingReleasePinMs <= 0) {
    errors.push('pendingReleasePinMs must be a positive number of milliseconds.');
  }

  if (typeof policy.batchLimit !== 'number' || !Number.isInteger(policy.batchLimit) || policy.batchLimit < 1 || policy.batchLimit > 1000) {
    errors.push('batchLimit must be an integer between 1 and 1000.');
  }

  // 2. Production-required relational guarantees
  if (
    typeof policy.transcriptRetentionDays === 'number' &&
    typeof policy.eventReplayRetentionDays === 'number' &&
    policy.transcriptRetentionDays < policy.eventReplayRetentionDays
  ) {
    errors.push(
      `Durable transcript retention (${policy.transcriptRetentionDays}d) must outlive transient event replay retention (${policy.eventReplayRetentionDays}d).`
    );
  }

  if (
    typeof policy.draftArtifactRetentionDays === 'number' &&
    typeof policy.orphanArtifactRetentionDays === 'number' &&
    policy.draftArtifactRetentionDays < policy.orphanArtifactRetentionDays
  ) {
    errors.push(
      `Draft artifact retention (${policy.draftArtifactRetentionDays}d) must be greater than or equal to orphan artifact retention (${policy.orphanArtifactRetentionDays}d).`
    );
  }

  if (errors.length > 0) {
    throw new CohortRetentionPolicyError(errors);
  }

  return policy as CohortRetentionPolicy;
}
