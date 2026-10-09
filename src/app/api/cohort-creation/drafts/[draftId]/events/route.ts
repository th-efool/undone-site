import { creationEventsHandler } from '@/src/server/domain/cohort-creation/durable-job.events';
import { creationEventRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationEvent.repo';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const handler = creationEventsHandler(creationEventRepo, getCreationOwner);
export async function GET(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  return handler(request, (await params).draftId);
}
