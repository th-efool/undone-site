import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Archives = dynamic(() => import('@/src/client/components/screens/cohort').then((mod) => mod.Archives));

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }): Promise<Metadata> {
  const { cohortId } = await params;
  return {
    title: `Archives - Cohort ${cohortId} | SideQuestHQ`,
    description: `Browse the archives for cohort ${cohortId} on SideQuestHQ.`,
    openGraph: {
      title: `Archives - Cohort ${cohortId} | SideQuestHQ`,
      description: `Browse the archives for cohort ${cohortId} on SideQuestHQ.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Archives - Cohort ${cohortId} | SideQuestHQ`,
      description: `Browse the archives for cohort ${cohortId} on SideQuestHQ.`,
    },
  };
}

export default async function ArchivesPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `Archives - Cohort ${cohortId}`,
    "description": `Browse the archives for cohort ${cohortId} on SideQuestHQ.`
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section>
        <h1 className="sr-only">Cohort Archives</h1>
        <Archives cohortId={cohortId} />
      </section>
    </main>
  );
}
