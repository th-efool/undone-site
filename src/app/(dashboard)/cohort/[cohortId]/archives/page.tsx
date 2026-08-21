import { Metadata } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { notFound } from 'next/navigation';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';

const Archives = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Archives));

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

export default async function ArchivesPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  
  const dbCohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: {
      creator: true,
      seasons: {
        include: {
          lessons: true,
        }
      }
    }
  });

  if (!dbCohort) {
    notFound();
  }

  const uiCohort = mapDbCohortToUiCohort(dbCohort);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `Archives - Cohort ${cohortId}`,
    "description": `Browse the archives for cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Archives cohortId={cohortId} cohort={uiCohort} />
    </>
  );
}
