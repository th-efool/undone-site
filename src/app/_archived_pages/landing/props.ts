import type { Metadata } from 'next';

export interface LandingPageProps {
  // Currently server-rendered without dynamic route parameters
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export interface LandingClientProps {
  // Client component props for LandingClient
}

export interface LandingMetadataProps {
  title: string;
  description: string;
  alternates: {
    canonical: string;
  };
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: string;
  };
}

export interface LandingJsonLdProps {
  '@context': string;
  '@type': string;
  name: string;
  applicationCategory: string;
  operatingSystem: string;
  url: string;
  description: string;
  offers: {
    '@type': string;
    price: string;
    priceCurrency: string;
  };
}

export const DEFAULT_LANDING_METADATA: Metadata = {
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

export const DEFAULT_LANDING_JSON_LD: LandingJsonLdProps = {
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
