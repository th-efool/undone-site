import type { Metadata } from 'next';
import { LandingClient } from '@/src/app/(landing)/page.client';

export const metadata: Metadata = {
  title: 'Microlearning App - Learn Anything in 5 Minutes a Day | SideQuestHQ',
  description: 'SideQuestHQ is the ultimate microlearning app. Break down complex subjects into bite-sized, 5-minute daily lessons and stay consistent.',
  alternates: {
    canonical: 'https://sidequesthq.com/features/microlearning',
  },
  openGraph: {
    title: 'Microlearning App - Learn Anything in 5 Minutes a Day | SideQuestHQ',
    description: 'SideQuestHQ is the ultimate microlearning app. Break down complex subjects into bite-sized, 5-minute daily lessons and stay consistent.',
    url: 'https://sidequesthq.com/features/microlearning',
    type: 'website',
  },
};

export default function MicrolearningFeature() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Microlearning App - SideQuestHQ',
    description: 'SideQuestHQ is the ultimate microlearning app. Break down complex subjects into bite-sized, 5-minute daily lessons and stay consistent.',
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
