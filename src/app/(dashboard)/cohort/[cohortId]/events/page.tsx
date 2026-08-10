import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Events = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Events));

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  return {
    title: `Events - Cohort ${cohortId} | SideQuestHQ`,
    description: `Upcoming and past events for cohort ${cohortId} on SideQuestHQ.`,
    openGraph: {
      title: `Events - Cohort ${cohortId} | SideQuestHQ`,
      description: `Upcoming and past events for cohort ${cohortId} on SideQuestHQ.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Events - Cohort ${cohortId} | SideQuestHQ`,
      description: `Upcoming and past events for cohort ${cohortId} on SideQuestHQ.`,
    },
  };
}

export default async function EventsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    "name": `Events - Cohort ${cohortId}`,
    "description": `Upcoming and past events for cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <>
      
      <Events cohortId={cohortId} />
    </>
  );
}
