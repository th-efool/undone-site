import { draftService } from '@/src/server/domain/cohort-creation/draft.runtime';
import { textUploadHandler } from '@/src/server/domain/cohort-creation/upload.http';
import { materialBlobStore } from '@/src/server/infrastructure/storage/creation.runtime';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
export const runtime = 'nodejs';
export const maxDuration = 35;
const upload = textUploadHandler(draftService, materialBlobStore, getCreationOwner);
export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  return upload(request, (await context.params).draftId);
}
