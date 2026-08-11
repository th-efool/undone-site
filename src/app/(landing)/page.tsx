import type { Metadata } from 'next';
import { LandingClient } from './page.client';

export const metadata: Metadata = {
  title: 'SideQuestHQ - The Easiest Way to Stay Consistent',
  description: 'Master any skill with microlearning and AI. SideQuestHQ helps you learn consistently, everyday.',
  alternates: {
    canonical: 'https://sidequesthq.com',
  },
  openGraph: {
    title: 'SideQuestHQ - The Easiest Way to Stay Consistent',
    description: 'Master any skill with microlearning and AI. SideQuestHQ helps you learn consistently, everyday.',
    url: 'https://sidequesthq.com',
    type: 'website',
  },
};

export default function Landing() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SideQuestHQ',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    url: 'https://sidequesthq.com',
    description: 'Master any skill with microlearning and AI. SideQuestHQ helps you learn consistently, everyday.',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingClient />
    </>
  );
}
