import type { InteractionRepository } from 'interaction-builder/runtime';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { computeTextStage, planTextFailure, planTextStage, sourceFingerprint } from './text-pipeline';

/** One durable checkpoint at a time. CAS fences concurrent workers and source edits. */
export async function advanceTextWorkspace(repo: InteractionRepository, ownerId: string, workspaceId: string): Promise<boolean> {
  const record = await repo.loadWorkspace<unknown>({ ownerId, workspaceId });
  if (!record) return false;
  const state = cohortWorkspaceSchema.parse(record.snapshot);
  if (state.processing.driver === 'durable') return false;
  if (state.processing.status !== 'queued' || state.processing.stage === 'done') return false;
  let action;
  try {
    action = computeTextStage(state);
    await repo.commitAction<CohortWorkspace>({
      ownerId, workspaceId, expectedRevision: record.revision,
      envelope: { actionId: crypto.randomUUID(), workspaceId, expectedRevision: record.revision, entityVersions: [], action },
      plan: planTextStage,
      requestId: `text:${workspaceId}:${state.processing.generation}:${state.processing.stage}`,
    });
  } catch (error) {
    if (error instanceof Error && ['STALE_WORKSPACE', 'STALE_SOURCE_RESULT', 'IDEMPOTENCY_MISMATCH'].includes(error.message)) return false;
    const failure = { type: 'fail_text_stage', generation: state.processing.generation, fingerprint: sourceFingerprint(state), error: error instanceof Error ? error.message : 'PROCESSING_ERROR' };
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
