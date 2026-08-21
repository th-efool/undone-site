import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { JoinCohortButton } from '@/src/client/screens/cohort/components/JoinCohortButton';

const Overview = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Overview));

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

import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { notFound } from 'next/navigation';

export default async function OverviewPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;

  const session = await auth();
  const isLoggedIn = !!session?.user;

  let isEnrolled = false;
  if (isLoggedIn && session?.user?.id) {
    const member = await prisma.cohortMember.findUnique({
      where: {
        cohortId_userId: {
          cohortId: cohortId,
          userId: session.user.id,
        },
      },
    });
    if (member) {
      isEnrolled = true;
    }
  }

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
    "name": `Overview - Cohort ${cohortId}`,
    "description": `Get an overview of cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <>
      <Overview cohortId={cohortId} cohort={uiCohort} isEnrolled={isEnrolled} isLoggedIn={isLoggedIn} />
    </>
  );
}
