import { notFound } from 'next/navigation';
import { z } from 'zod';
import { CreationExperience } from '@/src/client/screens/cohortCreation/CreationExperience';

export default async function QuestDraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  if (!z.uuid().safeParse(draftId).success) notFound();
  return <CreationExperience draftId={draftId} resume />;
}
