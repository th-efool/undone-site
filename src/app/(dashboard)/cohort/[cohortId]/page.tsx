import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  return {
    title: `Cohort ${cohortId} | SideQuestHQ`,
    description: `View details for cohort ${cohortId} on SideQuestHQ.`,
    openGraph: {
      title: `Cohort ${cohortId} | SideQuestHQ`,
      description: `View details for cohort ${cohortId} on SideQuestHQ.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Cohort ${cohortId} | SideQuestHQ`,
      description: `View details for cohort ${cohortId} on SideQuestHQ.`,
    },
  };
}

export default async function CohortPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;

  redirect(`/cohort/${cohortId}/overview`);
}
