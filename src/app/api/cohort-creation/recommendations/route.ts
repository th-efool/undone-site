import { RecommendationService } from '@/src/server/domain/cohort-creation/recommendation.service';
import { createRecommendationHandler, RecommendationBudget } from '@/src/server/domain/cohort-creation/recommendation.http';
import { creationRecommendationRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationRecommendation.repo';
import { createCohortModel } from '@/src/server/infrastructure/ai/modelRegistry';
import { VercelCohortAi } from '@/src/server/infrastructure/ai/vercelCohortAi';

export const runtime = 'nodejs';
export const maxDuration = 35;
export const POST = createRecommendationHandler(
  () => new RecommendationService(new VercelCohortAi(createCohortModel()), creationRecommendationRepo),
  new RecommendationBudget(),
);
