import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Questline = dynamic(() => import('@/src/client/components/screens/cohort').then((mod) => mod.Questline));

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `Questline - Cohort ${cohortId}`,
    "description": `Follow the questline for cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <>
      
      <Questline cohortId={cohortId} />
    </>
  );
}
