import { redirect } from 'next/navigation';

export default async function CohortPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;

  redirect(`/cohort/${cohortId}/overview`);
}
