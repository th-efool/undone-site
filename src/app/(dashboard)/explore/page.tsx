import { Metadata } from 'next';
import React, { Suspense } from 'react';
import { Explore } from '@/src/client/screens/dashboard/explore';

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
      <Suspense fallback={<Explore />}>
        <Explore />
      </Suspense>
    </>
  );
}
