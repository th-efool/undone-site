import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const Explore = dynamic(() => import('@/src/client/screens/dashboard/explore').then((mod) => mod.Explore));

export const metadata: Metadata = {
  title: 'Explore | Undone',
  description: 'Discover new cohorts, quests, and events on Undone. Join the community and start your journey.',
  openGraph: {
    title: 'Explore | Undone',
    description: 'Discover new cohorts, quests, and events on Undone. Join the community and start your journey.',
    url: 'https://undone.in/explore',
    siteName: 'Undone',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore | Undone',
    description: 'Discover new cohorts, quests, and events on Undone. Join the community and start your journey.',
  },
};

export default function explore() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Explore | Undone",
    "description": "Discover new cohorts, quests, and events on Undone. Join the community and start your journey."
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="sr-only">Explore Undone</h1>
      <Explore />
    </>
  );
}
