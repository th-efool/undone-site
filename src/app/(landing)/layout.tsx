import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SideQuestHQ - Level Up Your Life',
  description: 'Gamify your habits, achieve your goals, and level up your real life with SideQuestHQ. Start your journey today.',
  openGraph: {
    title: 'SideQuestHQ - Level Up Your Life',
    description: 'Gamify your habits, achieve your goals, and level up your real life with SideQuestHQ.',
    url: 'https://sidequesthq.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SideQuestHQ - Level Up Your Life',
    description: 'Gamify your habits, achieve your goals, and level up your real life with SideQuestHQ.',
  }
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SideQuestHQ',
    url: 'https://sidequesthq.com',
    description: 'Gamify your habits, achieve your goals, and level up your real life with SideQuestHQ.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
