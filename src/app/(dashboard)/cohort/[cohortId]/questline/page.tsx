import { Metadata } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { redirect, notFound } from 'next/navigation';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';

const Questline = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Questline));

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  return {
    title: `Questline - Cohort ${cohortId} | SideQuestHQ`,
    description: `Follow the questline for cohort ${cohortId} on SideQuestHQ.`,
    openGraph: {
      title: `Questline - Cohort ${cohortId} | SideQuestHQ`,
      description: `Follow the questline for cohort ${cohortId} on SideQuestHQ.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Questline - Cohort ${cohortId} | SideQuestHQ`,
      description: `Follow the questline for cohort ${cohortId} on SideQuestHQ.`,
    },
  };
}

export default async function QuestlinePage({ params }: { params: Promise<{ cohortId: string }> }) {
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
    "@type": "WebPage",
    "name": `Questline - Cohort ${cohortId}`,
    "description": `Follow the questline for cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Questline cohortId={cohortId} cohort={uiCohort} />
    </>
  );
}
