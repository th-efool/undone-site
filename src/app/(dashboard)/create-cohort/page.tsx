import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';

const CreateCohort = dynamic(
  () => import('@/src/client/components/screens/dashboard/createCohort').then((mod) => mod.CreateCohort)
);

export const metadata: Metadata = {
  title: 'Create a Cohort | SideQuestHQ',
  description: 'Create and organize a new cohort on SideQuestHQ. Bring your community together to learn and grow.',
  openGraph: {
    title: 'Create a Cohort | SideQuestHQ',
    description: 'Create and organize a new cohort on SideQuestHQ. Bring your community together to learn and grow.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Create a Cohort | SideQuestHQ',
    description: 'Create and organize a new cohort on SideQuestHQ. Bring your community together to learn and grow.',
  },
};

export default function CreateCohortPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Create a Cohort | SideQuestHQ',
    description: 'Create and organize a new cohort on SideQuestHQ. Bring your community together to learn and grow.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="sr-only">Create a Cohort</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <CreateCohort />
      </Suspense>
    </>
  );
}
