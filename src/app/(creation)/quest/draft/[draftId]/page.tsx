import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { CreationExperience } from '@/src/client/screens/cohortCreation/CreationExperience';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationDraftRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';

export default async function QuestDraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  if (!z.uuid().safeParse(draftId).success) notFound();
  const owner = await getCreationOwner();
  if (!owner) redirect(creationSignInUrl(`/quest/draft/${draftId}`));
  if (!await creationDraftRepo.load(owner, draftId)) notFound();
  return <CreationExperience draftId={draftId} resume />;
}
