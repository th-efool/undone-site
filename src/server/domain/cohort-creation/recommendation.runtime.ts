import 'server-only';
import { after } from 'next/server';
import { creationJobRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationJob.repo';
import { creationRecommendationRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationRecommendation.repo';
import { createCohortModel } from '@/src/server/infrastructure/ai/modelRegistry';
import { VercelCohortAi } from '@/src/server/infrastructure/ai/vercelCohortAi';
import { RecommendationService } from './recommendation.service';
import { recommendationDispatcher } from './recommendation.dispatch';
import { YoutubeMetadataReader } from './materials/youtube-metadata';
import { YoutubeMetadataRetentionService } from './materials/youtube-observation.service';

export const dispatchRecommendation = recommendationDispatcher(creationJobRepo,
  job => new RecommendationService(new VercelCohortAi(createCohortModel(), {
    maxRetries: 0, beforeCall: () => creationJobRepo.reserveModelCall(job),
  }), creationRecommendationRepo),
  work => after(work),
  () => console.error('[creation-short-job] Execution interrupted; saved job and timeout recovery remain available.'),
  () => ({ retainMetadata: async (...args) => {
    const storage = await import('@/src/server/infrastructure/storage/creation.runtime');
    return new YoutubeMetadataRetentionService(new YoutubeMetadataReader(), storage.creationArtifactRepository).retainMetadata(...args);
  } }));
