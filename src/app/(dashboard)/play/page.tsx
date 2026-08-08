import { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { PlaySkeleton } from '@/src/client/components/global/Skeleton';

const Play = dynamic(
  () => import('@/src/client/components/screens/dashboard/play').then((mod) => mod.Play)
);

export const metadata: Metadata = {
  title: 'Play | SideQuestHQ',
  description: 'Engage in interactive learning and play games to boost your knowledge on SideQuestHQ.',
  openGraph: {
    title: 'Play | SideQuestHQ',
    description: 'Engage in interactive learning and play games to boost your knowledge on SideQuestHQ.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Play | SideQuestHQ',
    description: 'Engage in interactive learning and play games to boost your knowledge on SideQuestHQ.',
  },
};

export default function PlayPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Play | SideQuestHQ',
    description: 'Engage in interactive learning and play games to boost your knowledge on SideQuestHQ.',
  };

  return (
    <main style={{ display: 'contents' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="sr-only">Play</h1>
      <section style={{ display: 'contents' }}>
        <Suspense fallback={<PlaySkeleton />}>
          <Play />
        </Suspense>
      </section>
    </main>
  );
}
