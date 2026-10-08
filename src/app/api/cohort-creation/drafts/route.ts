import { handleDraftRequest } from '@/src/server/domain/cohort-creation/draft.runtime';
export const runtime = 'nodejs';
export function POST(request: Request) { return handleDraftRequest(request); }
