import {
  type CohortWorkspace,
  cohortWorkspaceSchema,
} from './contracts';

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

/**
 * Validates deterministic workspace readiness before freeze or release.
 * Pure function shared across client UI and server execution.
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
