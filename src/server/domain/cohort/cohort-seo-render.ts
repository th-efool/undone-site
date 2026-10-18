import 'server-only';
import type { Metadata } from 'next';
import type { CohortSeo } from '@/src/shared/cohort-builder/seo';

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://undone.in').replace(/\/$/, '');
export const cohortUrl = (id: string, tab: 'overview' | 'questline' = 'overview') => `${BASE}/cohort/${id}/${tab}`;

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026');

export function resolveSeo(row: any, seo: CohortSeo | null) {
  return {
    title: seo?.metaTitle || clip(row.title || 'Cohort', 60),
    description: seo?.metaDescription || clip((row.description || row.subtitle || `Learn ${row.title} on Undone.`).replace(/\s+/g, ' '), 160),
    keywords: seo?.keywords ?? [...new Set([row.primaryTopic, ...(row.tags ?? []), ...(row.categories ?? [])].filter(Boolean))].slice(0, 16),
    ogAlt: seo?.ogAlt || `${row.title} cover image`,
  };
}

export function buildCohortMetadata(row: any, seo: CohortSeo | null, tab: 'overview' | 'questline'): Metadata {
  const r = resolveSeo(row, seo);
  const url = cohortUrl(row.id, tab);
  const suffix = tab === 'questline' ? ' - Curriculum' : '';
  const image = row.coverImage ? [{ url: row.coverImage, width: 1200, height: 630, alt: r.ogAlt }] : undefined;
  return {
    title: { absolute: `${r.title}${suffix} | Undone` }, // absolute => avoids duplicate "| Undone"
    description: r.description,
    keywords: r.keywords,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Undone',
      title: `${r.title}${suffix}`,
      description: r.description,
      images: image,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${r.title}${suffix}`,
      description: r.description,
      images: row.coverImage ? [row.coverImage] : undefined,
    },
  };
}

export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

/** Course + BreadcrumbList + FAQPage. NEVER include aggregateRating/review (UI rating is a placeholder). */
export function buildCohortJsonLd(row: any, seo: CohortSeo | null) {
  const r = resolveSeo(row, seo);
  const lessons = (row.seasons ?? []).flatMap((s: any) => s.lessons ?? []);
  const course: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': `${cohortUrl(row.id)}#course`,
    name: row.title,
    description: r.description,
    url: cohortUrl(row.id),
    image: row.coverImage || undefined,
    inLanguage: row.language || 'en',
    keywords: r.keywords.join(', '),
    teaches: seo?.teaches?.length ? seo.teaches : undefined,
    educationalLevel: row.difficulty ? String(row.difficulty).toLowerCase() : undefined,
    isAccessibleForFree: true,
    provider: { '@type': 'Organization', name: 'Undone', url: BASE },
    author: row.creator?.name ? { '@type': 'Person', name: row.creator.name } : undefined,
    datePublished: row.publishedAt || undefined,
    dateModified: row.updatedAt || undefined,
    numberOfCredits: undefined,
    offers: {
      '@type': 'Offer',
      category: 'Free',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: seo?.timeRequired,
    },
    hasPart: lessons.slice(0, 100).map((l: any, i: number) => ({
      '@type': 'LearningResource',
      position: i + 1,
      name: l.title,
      learningResourceType: l.lessonType === 'VIDEO' ? 'video' : 'article',
    })),
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Undone', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Cohorts', item: `${BASE}/explore` },
      { '@type': 'ListItem', position: 3, name: row.title, item: cohortUrl(row.id) },
    ],
  };

  const graph: unknown[] = [course, breadcrumbs];
  if (seo?.faq?.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: seo.faq.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  return graph;
}

/** Safe for <script type="application/ld+json">. Prevents XSS / script closing injection. */
export const serializeJsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
