import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `Hall of Fame - Cohort ${cohortId}`,
    "description": `See the top performers and achievements in cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <>
      
      <HallOfFame cohortId={cohortId} />
    </>
  );
}
