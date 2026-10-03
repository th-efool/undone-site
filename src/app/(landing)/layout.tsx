import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Undone - Level Up Your Life',
  description: 'Gamify your habits, achieve your goals, and level up your real life with Undone. Start your journey today.',
  openGraph: {
    title: 'Undone - Level Up Your Life',
    description: 'Gamify your habits, achieve your goals, and level up your real life with Undone.',
    url: 'https://sidequesthq.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone - Level Up Your Life',
    description: 'Gamify your habits, achieve your goals, and level up your real life with Undone.',
  }
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Undone',
    url: 'https://sidequesthq.com',
    description: 'Gamify your habits, achieve your goals, and level up your real life with Undone.',
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
