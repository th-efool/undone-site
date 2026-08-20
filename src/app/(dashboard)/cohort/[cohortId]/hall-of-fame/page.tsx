import { Metadata } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { redirect } from 'next/navigation';

const HallOfFame = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.HallOfFame));

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  return {
    title: `Hall of Fame - Cohort ${cohortId} | SideQuestHQ`,
    description: `See the top performers and achievements in cohort ${cohortId} on SideQuestHQ.`,
    openGraph: {
      title: `Hall of Fame - Cohort ${cohortId} | SideQuestHQ`,
      description: `See the top performers and achievements in cohort ${cohortId} on SideQuestHQ.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Hall of Fame - Cohort ${cohortId} | SideQuestHQ`,
      description: `See the top performers and achievements in cohort ${cohortId} on SideQuestHQ.`,
    },
  };
}

export default async function HallOfFamePage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth');
  }

  const isEnrolled = await prisma.cohortMember.findUnique({
    where: { cohortId_userId: { cohortId, userId: session.user.id } },
  });

  if (!isEnrolled) {
    redirect(`/cohort/${cohortId}/overview`);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `Hall of Fame - Cohort ${cohortId}`,
    "description": `See the top performers and achievements in cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HallOfFame cohortId={cohortId} />
    </>
  );
}
