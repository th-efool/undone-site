import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ExploreSkeleton } from '@/src/client/components/global/Skeleton';

const Explore = dynamic(() => import('@/src/client/screens/dashboard/explore').then((mod) => mod.Explore));

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Discover new cohorts, quests, and events on Undone. Join the community and start your journey.',
  openGraph: {
    title: 'Undone > Explore',
    description: 'Discover new cohorts, quests, and events on Undone. Join the community and start your journey.',
    url: 'https://undone.in/explore',
    siteName: 'Undone',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone > Explore',
    description: 'Discover new cohorts, quests, and events on Undone. Join the community and start your journey.',
  },
};

export default function ExplorePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Undone > Explore",
    "description": "Discover new cohorts, quests, and events on Undone. Join the community and start your journey."
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="sr-only">Explore Undone</h1>
      <Suspense fallback={<ExploreSkeleton />}>
        <Explore />
      </Suspense>
    </>
  );
}
