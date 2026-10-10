import { connectionReturnHandler } from '@/src/server/domain/cohort-creation/connectors-return.http';
import { draftService } from '@/src/server/domain/cohort-creation/draft.runtime';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
export const runtime = 'nodejs';
export const GET = connectionReturnHandler(draftService, getCreationOwner);
