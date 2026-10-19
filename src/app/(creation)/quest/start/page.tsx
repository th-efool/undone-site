import { redirect } from 'next/navigation';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';
import { cohortIntakeEnabled } from '@/src/shared/cohort-builder/intake';
import { CohortIntakeScreen } from '@/src/client/screens/cohortBuilder/CohortIntakeScreen';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Start Quest',
};

export const dynamic = 'force-dynamic';
export default async function StartCohortPage() {
  const ownerId = await getCreationOwner();
  if (!ownerId) redirect(creationSignInUrl('/'));
  return <CohortIntakeScreen key={ownerId} ownerId={ownerId} enabled={cohortIntakeEnabled(ownerId, process.env)} />;
}
