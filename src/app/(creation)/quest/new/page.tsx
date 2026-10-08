import { randomUUID } from 'node:crypto';
import { CreationExperience } from '@/src/client/screens/cohortCreation/CreationExperience';
import { querySchema } from '@/src/shared/cohort-creation/contracts';

export const dynamic = 'force-dynamic';
export default async function NewQuestPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const parsed = querySchema.safeParse(typeof q === 'string' ? q : '');
  return <CreationExperience draftId={randomUUID()} initialQuery={parsed.success ? parsed.data : ''} />;
}
