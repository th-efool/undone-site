import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  
  const dbCohort = await prisma.cohort.findFirst({
    where: { id: cohortId, ...accessibleCohortWhere((await auth())?.user?.id ?? null) },
    select: { title: true, description: true, coverImage: true },
  });

  const title = dbCohort?.title ? dbCohort.title : `Cohort ${cohortId}`;
  const description = dbCohort?.description || `Explore this learning cohort on Undone.`;
  const image = dbCohort?.coverImage || undefined;
  const socialTitle = `Undone - ${title}`;

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

