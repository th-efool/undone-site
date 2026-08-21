import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  
  const dbCohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { title: true, description: true, coverImage: true },
  });

  const title = dbCohort?.title ? `${dbCohort.title} | SideQuestHQ` : `Cohort ${cohortId} | SideQuestHQ`;
  const description = dbCohort?.description || `Explore this learning cohort on SideQuestHQ.`;
  const image = dbCohort?.coverImage || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CohortPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;

  redirect(`/cohort/${cohortId}/overview`);
}
