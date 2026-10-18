import type { InteractionRepository } from 'interaction-builder/runtime';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { computeTextStage, planTextFailure, planTextStage, sourceFingerprint } from './text-pipeline';
import { devLogger } from '@/src/shared/lib/dev-logger';

/** One durable checkpoint at a time. CAS fences concurrent workers and source edits. */
export async function advanceTextWorkspace(repo: InteractionRepository, ownerId: string, workspaceId: string): Promise<boolean> {
  const logger = devLogger.scoped('TextWorker');
  const record = await repo.loadWorkspace<unknown>({ ownerId, workspaceId });
  if (!record) return false;
  const state = cohortWorkspaceSchema.parse(record.snapshot);
  if (state.processing.driver === 'durable') return false;
  if (state.processing.status !== 'queued' || state.processing.stage === 'done') return false;

  logger.info(`Advancing workspace ${workspaceId} text processing (current stage: "${state.processing.stage}", gen ${state.processing.generation})`);
  let action;
  try {
    action = computeTextStage(state);
    logger.debug(`Computed text stage action for ${workspaceId}:`, { stage: action.stage, type: action.type });
    const result = await repo.commitAction<CohortWorkspace>({
      ownerId, workspaceId, expectedRevision: record.revision,
      envelope: { actionId: crypto.randomUUID(), workspaceId, expectedRevision: record.revision, entityVersions: [], action },
      plan: planTextStage,
      requestId: `text:${workspaceId}:${state.processing.generation}:${state.processing.stage}`,
    });
    logger.info(`Advanced workspace ${workspaceId} from stage "${state.processing.stage}". Next revision: #${result.revision}`);
  } catch (error) {
    if (error instanceof Error && ['STALE_WORKSPACE', 'STALE_SOURCE_RESULT', 'IDEMPOTENCY_MISMATCH'].includes(error.message)) {
      logger.warn(`Text stage advance conflict for ${workspaceId} (${state.processing.stage}): ${error.message}`);
      return false;
    }
    const failure = { type: 'fail_text_stage', generation: state.processing.generation, fingerprint: sourceFingerprint(state), error: error instanceof Error ? error.message : 'PROCESSING_ERROR' };
    logger.error(`Text stage failed on ${workspaceId} (${state.processing.stage}):`, error);
    devLogger.recordIssue({
      severity: 'ERROR',
      component: 'TextWorker',
      title: `Text processing failure in stage "${state.processing.stage}"`,
      details: error instanceof Error ? error.message : String(error),
      error: String(error),
      context: { workspaceId, stage: state.processing.stage, generation: state.processing.generation },
    });
    try {
      await repo.commitAction<CohortWorkspace>({
        ownerId, workspaceId, expectedRevision: record.revision,
        envelope: { actionId: crypto.randomUUID(), workspaceId, expectedRevision: record.revision, entityVersions: [], action: failure },
        plan: planTextFailure,
        requestId: `text-fail:${workspaceId}:${state.processing.generation}:${state.processing.stage}`,
      });
    } catch (commitError) {
      if (!(commitError instanceof Error) || commitError.message !== 'STALE_WORKSPACE') throw commitError;
    }
  }
  return true;
}
