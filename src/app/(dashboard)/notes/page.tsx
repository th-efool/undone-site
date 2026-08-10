import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Notes = dynamic(
  () => import('@/src/client/screens/dashboard/notes').then((mod) => mod.Notes)
);

export const metadata: Metadata = {
  title: 'Notes | SideQuestHQ',
  description: 'Manage and review your study notes on SideQuestHQ. Keep your thoughts organized and accessible.',
  openGraph: {
    title: 'Notes | SideQuestHQ',
    description: 'Manage and review your study notes on SideQuestHQ. Keep your thoughts organized and accessible.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notes | SideQuestHQ',
    description: 'Manage and review your study notes on SideQuestHQ. Keep your thoughts organized and accessible.',
  },
};

export default function NotesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Notes | SideQuestHQ',
    description: 'Manage and review your study notes on SideQuestHQ. Keep your thoughts organized and accessible.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <Notes />
      </Suspense>
    </>
  );
}
