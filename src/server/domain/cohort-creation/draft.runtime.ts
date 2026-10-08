import 'server-only';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationDraftRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import { creationRecommendationRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationRecommendation.repo';
import { createCohortModel } from '@/src/server/infrastructure/ai/modelRegistry';
import { VercelCohortAi } from '@/src/server/infrastructure/ai/vercelCohortAi';
import { RecommendationService } from './recommendation.service';
import { DraftService } from './draft.service';
import { draftHandlers } from './draft.http';

export const draftService = new DraftService(creationDraftRepo, () => new RecommendationService(new VercelCohortAi(createCohortModel()), creationRecommendationRepo));
export const handleDraftRequest = draftHandlers(draftService, getCreationOwner);
