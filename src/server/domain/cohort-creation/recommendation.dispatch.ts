import { randomUUID } from 'node:crypto';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { CreationJobRepository, ClaimedRecommendationJob, ClaimedYoutubeInspectionJob } from './durable-job';
import type { YoutubeMetadataRetentionService } from './materials/youtube-observation.service';
import type { RecommendationService } from './recommendation.service';
import { executeCreationJob } from './durable-job.runner';

/** Short searches and metadata intake can run on the web host. SQL owns completion. */
export function recommendationDispatcher(repo: CreationJobRepository,
  recommender: (job: ClaimedRecommendationJob) => Pick<RecommendationService, 'recommend'>,
  defer: (work: () => Promise<void>) => void,
  reportError: () => void,
  inspector?: (job: ClaimedYoutubeInspectionJob) => Pick<YoutubeMetadataRetentionService, 'retainMetadata'>) {
  return (ownerId: string, snapshot: CreationSnapshot) => {
    if (snapshot.status !== 'running' || !snapshot.activeRequestId) return;
    const inspecting = snapshot.stage === 'starting_point' && inspector && snapshot.materials.some(source =>
      source.status === 'acquiring' && ['youtube_video', 'youtube_playlist'].includes(source.kind) &&
      !snapshot.youtubeSources.some(metadata => metadata.materialId === source.id));
    if (snapshot.stage !== 'recommendations' && !inspecting) return;
    const scope = { ownerId, draftId: snapshot.draftId, requestId: snapshot.activeRequestId,
      ...(inspecting ? { kind: 'inspect_youtube' as const } : {}) };
    defer(async () => {
      try {
        // Multiple web observers and the polling worker race through the same fenced claim.
        const job = await repo.claim(`web-search-${randomUUID()}`, scope);
        if (!job) return;
        if (job.kind !== (scope.kind ?? 'recommendations')) throw new Error('Unexpected scoped job');
        await executeCreationJob(repo, job, recommender, AbortSignal.timeout(32_000), undefined, undefined, undefined, inspector);
      } catch { reportError(); }
    });
  };
}
