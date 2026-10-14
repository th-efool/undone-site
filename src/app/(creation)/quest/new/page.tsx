import { randomUUID } from 'node:crypto';
import { CreationExperience } from '@/src/client/screens/cohortCreation/CreationExperience';
import { querySchema } from '@/src/shared/cohort-creation/contracts';
import { redirect } from 'next/navigation';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';
import { LegacyLandingHandoff } from '@/src/client/screens/cohortCreation/LegacyLandingHandoff';

export const dynamic = 'force-dynamic';
export default async function NewQuestPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; handoff?: string }> }) {
  const { q, handoff } = await searchParams;
  const parsed = querySchema.safeParse(typeof q === 'string' ? q : '');
  const ownerId = await getCreationOwner();
  if (!ownerId) redirect(creationSignInUrl(handoff === '1' ? '/quest/new?handoff=1' : `/quest/new${parsed.success ? `?q=${encodeURIComponent(parsed.data)}` : ''}`));
  if (handoff === '1') return <LegacyLandingHandoff key={ownerId} ownerId={ownerId} />;
  return <CreationExperience draftId={randomUUID()} initialQuery={parsed.success ? parsed.data : ''} />;
}
