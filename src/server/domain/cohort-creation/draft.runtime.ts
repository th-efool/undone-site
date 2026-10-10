import { loadBuiltCurriculum } from './processing.runtime';
import 'server-only';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationDraftRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import { creationJobRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationJob.repo';
import { DraftService } from './draft.service';
import { draftHandlers } from './draft.http';

export const draftService = new DraftService(creationDraftRepo, creationJobRepo, { load: loadBuiltCurriculum });
export const handleDraftRequest = draftHandlers(draftService, getCreationOwner);
