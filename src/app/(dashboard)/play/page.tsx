import { Metadata } from 'next';
import React, { Suspense } from 'react';
import { Play } from '@/src/client/screens/dashboard/play';
import { PlaySkeleton } from '@/src/client/components/global/Skeleton';

export const metadata: Metadata = {
  title: 'Play',
  description: 'Engage in interactive learning and play games to boost your knowledge on Undone.',
  openGraph: {
    title: 'Undone > Play',
    description: 'Engage in interactive learning and play games to boost your knowledge on Undone.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone > Play',
    description: 'Engage in interactive learning and play games to boost your knowledge on Undone.',
  },
};

export default function PlayPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Undone > Play',
    description: 'Engage in interactive learning and play games to boost your knowledge on Undone.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<PlaySkeleton />}>
        <Play />
      </Suspense>
    </>
  );
}
