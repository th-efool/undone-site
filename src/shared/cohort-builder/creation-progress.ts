import type { CohortWorkspace } from './contracts';
import { isBuildComplete } from './creation-state';

export const CREATION_STAGES = ['understanding', 'chunking', 'analysis', 'assembly'] as const;
export type CanonicalStage = typeof CREATION_STAGES[number];

export interface StageStatus {
  status: 'complete' | 'running' | 'failed' | 'canceled' | 'pending';
  completedCount: number;
  totalCount: number;
  failedCount: number;
  retryable: boolean;
  isCanceled: boolean;
}

export type StageProgressDetails = Record<CanonicalStage, StageStatus>;

export function deriveStageProgress(workspace: CohortWorkspace): StageProgressDetails {
  const sources = workspace.sources;
  const jobs = (workspace.processing.jobs ?? []).filter(j => j.status !== 'superseded');
  const complete = isBuildComplete(workspace);
  const current = workspace.processing.stage;
  const index = current === 'chunking' ? 1 : current === 'analysis' ? 2 : current === 'assembly' || current === 'done' ? 3 : 0;
  const canceled = workspace.processing.error === 'PROCESSING_CANCELED';
  let priorComplete = true;

  return Object.fromEntries(CREATION_STAGES.map((stage, i) => {
    const total = stage === 'assembly' ? 1 : sources.length;
    const groups = stage === 'assembly'
      ? [jobs.filter(j => j.stage === 'assembly')]
      : sources.map(s => jobs.filter(j => j.sourceId === s.id && (stage === 'understanding' ? ['acquisition', 'extraction', 'understanding'].includes(j.stage) : j.stage === stage)));
    const stageJobs = groups.flat();
    let count = groups.filter(group => group.length > 0 && group.every(j => j.status === 'accepted') && group.some(j => j.stage === stage)).length;
    const failedCount = groups.filter(group => group.some(j => j.status === 'failed')).length;
    let done = sources.length > 0 && priorComplete && count === total;
    if (!jobs.length) {
      done = sources.length > 0 && (complete || (['queued', 'processing', 'failed'].includes(workspace.processing.status) && i < index));
      count = done ? total : 0;
    }
    if (stage === 'assembly') done = complete;
    const isRunningJob = stageJobs.some(j => j.status === 'running');
    const isQueuedJob = stageJobs.some(j => j.status === 'queued');
    const failed = (failedCount > 0 && (priorComplete || i <= index)) || (!jobs.length && workspace.processing.status === 'failed' && i === index);
    const stopped = (canceled && (!jobs.length || stageJobs.length > 0)) || (stageJobs.some(j => j.status === 'canceled') && (priorComplete || i <= index));
    const active = isRunningJob || ((priorComplete || i <= index) && isQueuedJob) || (!jobs.length && ['queued', 'processing'].includes(workspace.processing.status) && i === index);
    const status: StageStatus['status'] = done ? 'complete' : failed ? 'failed' : stopped ? 'canceled' : active ? 'running' : 'pending';
    priorComplete = done;
    return [stage, {
      status,
      completedCount: done ? total : count,
      totalCount: total,
      failedCount,
      retryable: stageJobs.some(j => j.status === 'failed' && j.retryable),
      isCanceled: !done && stopped,
    }];
  })) as StageProgressDetails;
}
