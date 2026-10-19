import { Metadata } from 'next';
import React, { Suspense } from 'react';
import { Notes } from '@/src/client/screens/dashboard/notes';
import { NotesSkeleton } from '@/src/client/components/global/Skeleton';

export const metadata: Metadata = {
  title: 'Notes',
  description: 'Manage and review your study notes on Undone. Keep your thoughts organized and accessible.',
  openGraph: {
    title: 'Undone > Notes',
    description: 'Manage and review your study notes on Undone. Keep your thoughts organized and accessible.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone > Notes',
    description: 'Manage and review your study notes on Undone. Keep your thoughts organized and accessible.',
  },
};

export default function NotesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Undone > Notes',
    description: 'Manage and review your study notes on Undone. Keep your thoughts organized and accessible.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<NotesSkeleton />}>
        <Notes />
      </Suspense>
    </>
  );
}
