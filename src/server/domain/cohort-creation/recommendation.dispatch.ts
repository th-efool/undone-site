import { randomUUID } from 'node:crypto';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { CreationJobRepository, ClaimedRecommendationJob } from './durable-job';
import type { RecommendationService } from './recommendation.service';
import { executeCreationJob } from './durable-job.runner';

/** Short searches can run on the web host. SQL still owns execution and completion. */
export function recommendationDispatcher(repo: CreationJobRepository,
  recommender: (job: ClaimedRecommendationJob) => Pick<RecommendationService, 'recommend'>,
  defer: (work: () => Promise<void>) => void,
  reportError: () => void) {
  return (ownerId: string, snapshot: CreationSnapshot) => {
    if (snapshot.stage !== 'recommendations' || snapshot.status !== 'running' || !snapshot.activeRequestId) return;
    const scope = { ownerId, draftId: snapshot.draftId, requestId: snapshot.activeRequestId };
    defer(async () => {
      try {
        // Multiple web observers and the polling worker race through the same fenced claim.
        const job = await repo.claim(`web-search-${randomUUID()}`, scope);
        if (!job) return;
        if (job.kind !== 'recommendations') throw new Error('Unexpected scoped job');
        await executeCreationJob(repo, job, recommender, AbortSignal.timeout(32_000));
      } catch { reportError(); }
    });
  };
}
