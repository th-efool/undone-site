import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Hero } from '@/src/client/screens/landing';

const VideoExplainer = dynamic(
  () => import('@/src/client/screens/landing/VideoExplainer').then((mod) => mod.VideoExplainer),
  {
    loading: () => <div style={{ minHeight: '100vh', backgroundColor: '#0E1738' }} />,
  }
);

const Ikigai = dynamic(
  () => import('@/src/client/screens/landing/Ikigai').then((mod) => mod.Ikigai)
);

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sidequesthq.com';

export const metadata: Metadata = {
  title: 'Undone — Turn Any Rabbit Hole & Video into Bite-Sized Learning Quests',
  description:
    'Master any skill in 5 minutes a day. Undone converts long YouTube playlists, courses, and articles into interactive microlearning quests with AI guidance, distraction-free playback, and habit streaks.',
  keywords: [
    'Undone',
    'AI microlearning',
    'microlearning app',
    'turn YouTube into courses',
    'convert YouTube playlist to course',
    'AI study planner',
    'habit tracking',
    'spaced repetition',
    'cohort-based learning',
    'distraction-free video player',
    'bite-sized courses',
    'learning streaks',
    'interstitial learning',
    'self-directed learning',
    'SideQuestHQ',
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Undone',
    title: 'Undone — Turn Any Rabbit Hole & Video into Bite-Sized Learning Quests',
    description:
      'Master any skill in 5 minutes a day. Undone converts long YouTube playlists, courses, and articles into interactive microlearning quests with AI guidance, distraction-free playback, and habit streaks.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Undone — Turn Any Rabbit Hole & Video into Bite-Sized Learning Quests',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone — Turn Any Rabbit Hole & Video into Bite-Sized Learning Quests',
    description:
      'Master any skill in 5 minutes a day. Undone converts long YouTube playlists, courses, and articles into interactive microlearning quests with AI guidance and habit streaks.',
    images: ['/twitter-image.png'],
    creator: '@Undone',
    site: '@Undone',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function LandingPage() {
  const structuredData = {
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
      {
        '@type': 'FAQPage',
        '@id': `${siteUrl}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is Undone and how does it work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Undone is a modern microlearning platform designed to turn long-form educational content—such as 2-hour YouTube tutorials, recorded lectures, and articles—into interactive, 5-minute learning quests. You simply enter a topic or paste a media link, and our AI organizes it into a structured, daily learning path.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does Undone convert YouTube videos into bite-sized courses?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Undone extracts transcripts and media timestamps, analyzing cognitive load and conceptual breakpoints. Our pedagogical vector engine then sections the video into 5- to 10-minute micro-lessons complete with key takeaways, automated notes, and interactive checkpoints.',
            },
          },
          {
            '@type': 'Question',
            name: 'What is interstitial time learning?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Interstitial time refers to the natural 5- to 15-minute pockets throughout your day—waiting for coffee, commuting, waiting between meetings, or unwinding before bed. Instead of doomscrolling algorithmic feeds, Undone helps you leverage these brief windows to build compound knowledge.',
            },
          },
          {
            '@type': 'Question',
            name: 'How is Undone different from traditional online course platforms?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Traditional platforms suffer from an 85%+ abandonment rate because 60-minute lectures are overwhelming. Undone removes video distraction, eliminates YouTube recommendations, slices lessons into high-retention chunks, and pairs you with cohorts and streaks for real accountability.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is Undone free to use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes! Undone offers a robust free tier allowing anyone to explore featured cohorts, import educational playlists, track daily learning streaks, and use the distraction-free focus player.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I study with friends or join learning cohorts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Absolutely. Undone includes synchronized cohorts and global study rooms where participants progress through curriculum seasons together, compare notes, and stay accountable.',
            },
          },
        ],
      },
      {
        '@type': 'HowTo',
        '@id': `${siteUrl}/#howto`,
        name: 'How to Turn Any YouTube Playlist or Topic into a Microlearning Quest',
        description:
          'Step-by-step walkthrough on converting long videos and sprawling playlists into structured 5-minute daily microlearning quests with Undone.',
        totalTime: 'PT5M',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Drop In Any Source',
            text: 'Paste a 2-hour YouTube video, course playlist, Notion document, or topic in the Undone search interface.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'AI Pedagogical Chunking',
            text: 'Our 12D vector space algorithm slices content into logical, 5-minute interactive quest chunks with automated notes and takeaways.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Learn & Build Compounding Streaks',
            text: 'Watch distraction-free video chunks, maintain your daily study streak, and retain knowledge with spaced repetition checkpoints.',
          },
        ],
      },
      {
        '@type': 'VideoObject',
        '@id': `${siteUrl}/#video-explainer`,
        name: 'Undone — Curiosity with a Finish Line',
        description:
          'Watch how Undone turns fragmented interstitial moments and long-form YouTube videos into compounding knowledge.',
        thumbnailUrl: [`${siteUrl}/images/hero-poster.webp`, `${siteUrl}/og-image.png`],
        uploadDate: '2026-01-01T08:00:00+00:00',
        contentUrl: `${siteUrl}/videos/undone-investor-film.mp4`,
        embedUrl: `${siteUrl}/#video-explainer`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main>
        <Hero />
        <VideoExplainer />
        <Ikigai />
      </main>
    </>
  );
}
