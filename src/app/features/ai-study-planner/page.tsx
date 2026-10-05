import type { Metadata } from 'next';
import { LandingClient } from '@/src/app/_archived_pages/landing/page.client';

export const metadata: Metadata = {
  title: 'AI Study Planner & Tracker | Undone',
  description: 'Let AI build your personalized study quest. Undone uses artificial intelligence to schedule, track, and adapt your microlearning journey for maximum consistency.',
  keywords: [
    'AI study planner',
    'smart study tracker',
    'personalized learning path',
    'microlearning schedule',
    'Undone',
  ],
  alternates: {
    canonical: 'https://undone.in/features/ai-study-planner',
  },
  openGraph: {
    title: 'AI Study Planner & Tracker | Undone',
    description: 'Let AI build your personalized study quest. Undone uses artificial intelligence to schedule, track, and adapt your microlearning journey for maximum consistency.',
    url: 'https://undone.in/features/ai-study-planner',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AI Study Planner & Tracker | Undone',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Study Planner & Tracker | Undone',
    description: 'Let AI build your personalized study quest. Undone uses artificial intelligence to schedule, track, and adapt your microlearning journey.',
    images: ['/twitter-image.png'],
  },
};

export default function AiStudyPlannerFeature() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'AI Study Planner & Tracker — Undone',
    description: 'Let AI build your personalized study quest. Undone uses artificial intelligence to schedule, track, and adapt your microlearning journey for maximum consistency.',
    url: 'https://undone.in/features/ai-study-planner',
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
