import { randomUUID } from 'node:crypto';
import { CreationExperience } from '@/src/client/screens/cohortCreation/CreationExperience';
import { querySchema } from '@/src/shared/cohort-creation/contracts';
import { redirect } from 'next/navigation';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';

export const dynamic = 'force-dynamic';
export default async function NewQuestPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const parsed = querySchema.safeParse(typeof q === 'string' ? q : '');
  if (!await getCreationOwner()) redirect(creationSignInUrl(`/quest/new${parsed.success ? `?q=${encodeURIComponent(parsed.data)}` : ''}`));
  return <CreationExperience draftId={randomUUID()} initialQuery={parsed.success ? parsed.data : ''} />;
}
