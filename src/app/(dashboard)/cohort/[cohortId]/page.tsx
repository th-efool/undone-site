import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);

  const title = pub?.row.title || `Cohort ${cohortId}`;
  const description = pub?.row.description || 'Explore this learning cohort on Undone.';
  const image = pub?.row.coverImage || undefined;
  const socialTitle = `Undone > ${title}`;

  return {
    title,
    description,
    openGraph: {
      title: socialTitle,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CohortPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  redirect(`/cohort/${cohortId}/overview`);
}
