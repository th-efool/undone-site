import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const Explore = dynamic(() => import('@/src/client/components/screens/dashboard/explore').then((mod) => mod.Explore));

export const metadata: Metadata = {
  title: 'Explore | SideQuestHQ',
  description: 'Discover new cohorts, quests, and events on SideQuestHQ. Join the community and start your journey.',
  openGraph: {
    title: 'Explore | SideQuestHQ',
    description: 'Discover new cohorts, quests, and events on SideQuestHQ. Join the community and start your journey.',
    url: 'https://sidequesthq.com/explore',
    siteName: 'SideQuestHQ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore | SideQuestHQ',
    description: 'Discover new cohorts, quests, and events on SideQuestHQ. Join the community and start your journey.',
  },
};

export default function explore() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Explore | SideQuestHQ",
    "description": "Discover new cohorts, quests, and events on SideQuestHQ. Join the community and start your journey."
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="sr-only">Explore SideQuestHQ</h1>
      <Explore />
    </>
  );
}
