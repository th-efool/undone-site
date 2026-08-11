import type { Metadata } from 'next';
import { LandingClient } from '@/src/app/(landing)/page.client';

export const metadata: Metadata = {
  title: 'AI Study Planner & Tracker | SideQuestHQ',
  description: 'Let AI build your perfect study plan. SideQuestHQ uses artificial intelligence to schedule, track, and adapt your learning journey for maximum consistency.',
  alternates: {
    canonical: 'https://sidequesthq.com/features/ai-study-planner',
  },
  openGraph: {
    title: 'AI Study Planner & Tracker | SideQuestHQ',
    description: 'Let AI build your perfect study plan. SideQuestHQ uses artificial intelligence to schedule, track, and adapt your learning journey for maximum consistency.',
    url: 'https://sidequesthq.com/features/ai-study-planner',
    type: 'website',
  },
};

export default function AiStudyPlannerFeature() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'AI Study Planner & Tracker - SideQuestHQ',
    description: 'Let AI build your perfect study plan. SideQuestHQ uses artificial intelligence to schedule, track, and adapt your learning journey for maximum consistency.',
    url: 'https://sidequesthq.com/features/ai-study-planner',
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
