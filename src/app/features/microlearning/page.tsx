import type { Metadata } from 'next';
import { LandingClient } from '@/src/app/_archived_pages/landing/page.client';

export const metadata: Metadata = {
  title: 'Microlearning App — Learn Anything in 5 Minutes a Day | Undone',
  description: 'Master any topic in 5 minutes a day with Undone. Convert long courses, videos, and articles into bite-sized daily lessons and build permanent knowledge.',
  keywords: [
    'microlearning app',
    'bite-sized learning',
    '5 minute lessons',
    'spaced repetition microlearning',
    'Undone',
  ],
  alternates: {
    canonical: 'https://sidequesthq.com/features/microlearning',
  },
  openGraph: {
    title: 'Microlearning App — Learn Anything in 5 Minutes a Day | Undone',
    description: 'Master any topic in 5 minutes a day with Undone. Convert long courses, videos, and articles into bite-sized daily lessons and build permanent knowledge.',
    url: 'https://sidequesthq.com/features/microlearning',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Microlearning App | Undone',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Microlearning App — Learn Anything in 5 Minutes a Day | Undone',
    description: 'Master any topic in 5 minutes a day with Undone. Convert long courses and videos into bite-sized daily lessons.',
    images: ['/twitter-image.png'],
  },
};

export default function MicrolearningFeature() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Microlearning App — Undone',
    description: 'Master any topic in 5 minutes a day with Undone. Convert long courses, videos, and articles into bite-sized daily lessons.',
    url: 'https://sidequesthq.com/features/microlearning',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* We reuse the main landing page UI, which dynamically introduces the features */}
      <LandingClient />
    </>
  );
}
