import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sidequesthq.in';

export const metadata: Metadata = {
  title: 'Undone — For a more curious you',
  description: 'Turn existing curiosity into lasting understanding. Seamlessly learn from YouTube, articles, and podcasts in the spare moments of everyday life — without managing courses or schedules.',
  openGraph: {
    title: 'Undone — For a more curious you',
    description: 'Turn existing curiosity into lasting understanding. Seamlessly learn from YouTube, articles, and podcasts in the spare moments of everyday life without managing courses or schedules.',
    url: siteUrl,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Undone — Turn curiosity into lasting understanding',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone — For a more curious you',
    description: 'Turn existing curiosity into lasting understanding. Seamlessly learn from YouTube, articles, and podcasts in everyday moments.',
    images: ['/twitter-image.png'],
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'Undone',
        description:
          'Turn existing curiosity into lasting understanding. Seamlessly learn from YouTube, articles, and podcasts in the spare moments of everyday life.',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/quest/new?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'Undone',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/undone-logo-transparent.svg`,
          width: 512,
          height: 512,
        },
        sameAs: [
          'https://x.com/undone',
          'https://github.com/th-efool/sidequesthq-site',
        ],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}/#app`,
        name: 'Undone',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web, iOS, Android',
        url: siteUrl,
        description:
          'AI-powered microlearning platform converting long-form video into bite-sized daily lessons with streak tracking and cohorts.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '1280',
          bestRating: '5',
          worstRating: '1',
        },
        featureList: [
          'Convert YouTube playlists into interactive courses',
          '5-minute bite-sized microlearning chunks',
          'Distraction-free focus media player',
          '12D pedagogical vector learning engine',
          'Daily streak and habit consistency tracking',
          'Collaborative cohort study rooms',
        ],
      },
    ],
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
