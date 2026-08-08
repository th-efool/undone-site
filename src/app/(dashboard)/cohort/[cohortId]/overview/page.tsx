import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Overview = dynamic(() => import('@/src/client/components/screens/cohort').then((mod) => mod.Overview));

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  return {
    title: `Overview - Cohort ${cohortId} | SideQuestHQ`,
    description: `Get an overview of cohort ${cohortId} on SideQuestHQ.`,
    openGraph: {
      title: `Overview - Cohort ${cohortId} | SideQuestHQ`,
      description: `Get an overview of cohort ${cohortId} on SideQuestHQ.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Overview - Cohort ${cohortId} | SideQuestHQ`,
      description: `Get an overview of cohort ${cohortId} on SideQuestHQ.`,
    },
  };
}

export default async function OverviewPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `Overview - Cohort ${cohortId}`,
    "description": `Get an overview of cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <>
      
      <Overview cohortId={cohortId} />
    </>
  );
}
