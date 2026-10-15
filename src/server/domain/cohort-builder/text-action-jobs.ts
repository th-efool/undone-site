import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from './text-artifacts';
import { enqueueTextJobPlanInTransaction } from './text-job-scheduler';
import { retryTextJob } from './text-jobs';
import { textJobStatus } from './text-job-status';
import { enqueueJourneyJobPlanInTransaction } from './journey-job-scheduler';

/** Called only inside the authorized canonical repository transaction. */
export async function reconcileTextAction(tx: TextArtifactSql, workspaceId: string, state: unknown, action: unknown) {
  const next = cohortWorkspaceSchema.parse(state);
  next.processing.driver = 'durable';
  const typed = action as { type?: string; jobId?: string; sourceId?:string };
  if (next.journey) {
    await enqueueJourneyJobPlanInTransaction(tx, workspaceId, next);
  }
  if (typed.type === 'retry_text_job') {
    if (!await retryTextJob(tx, workspaceId, typed.jobId!, new Date())) throw new Error('JOB_NOT_RETRYABLE');
  } else if (typed.type === 'cancel_source_processing') {
    await tx.query(`UPDATE "cohort_text_jobs" SET "status"='canceled',"fence"="fence"+1,
      "leaseToken"=NULL,"leaseUntil"=NULL,"leaseOwner"=NULL
      WHERE "workspaceId"=$1 AND "sourceId"=$2 AND "status" IN ('queued','running','failed')`,[workspaceId,typed.sourceId]);
  } else if (typed.type === 'cancel_text_processing') {
    await tx.query(`UPDATE "cohort_text_jobs" SET "status" = 'canceled', "fence" = "fence" + 1,
      "leaseToken" = NULL, "leaseUntil" = NULL, "leaseOwner" = NULL
      WHERE "workspaceId" = $1 AND "jobKey" LIKE 'text:%'
        AND "status" IN ('queued', 'running', 'failed') RETURNING "id"`, [workspaceId]);
  } else if (typed.type === 'prepare_release' || typed.type === 'commit_release') {
    return textJobStatus(tx, workspaceId, next);
  } else if (next.sources.length && next.processing.error !== 'PROCESSING_CANCELED') {
    await enqueueTextJobPlanInTransaction(tx, workspaceId, next);
  } else if (typed.type === 'remove_source') {
    await enqueueTextJobPlanInTransaction(tx, workspaceId, next);
  }
  return textJobStatus(tx, workspaceId, next);
}
