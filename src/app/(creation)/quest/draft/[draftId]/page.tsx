import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { CreationExperience } from '@/src/client/screens/cohortCreation/CreationExperience';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationDraftRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';
import { querySchema } from '@/src/shared/cohort-creation/contracts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quest Draft',
};

export default async function QuestDraftPage({ params, searchParams }: { params: Promise<{ draftId: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const { draftId } = await params;
  if (!z.uuid().safeParse(draftId).success) notFound();
  const pending = querySchema.safeParse((await searchParams).q);
  const initialQuery = pending.success ? pending.data : '';
  const owner = await getCreationOwner();
  if (!owner) redirect(creationSignInUrl(`/quest/draft/${draftId}${initialQuery ? `?q=${encodeURIComponent(initialQuery)}` : ''}`));
  const snapshot = await creationDraftRepo.load(owner, draftId);
  if (!snapshot) notFound();
  return <CreationExperience draftId={draftId} initialQuery={snapshot.query ? '' : initialQuery} resume />;
}
