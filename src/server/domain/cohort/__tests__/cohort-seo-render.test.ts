import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildCohortJsonLd,
  buildCohortMetadata,
  NOINDEX_METADATA,
  serializeJsonLd,
} from '../cohort-seo-render';

describe('Cohort SEO render utilities', () => {
  const mockDbRow = {
    id: 'cohort_3a85ba93_ab12cd34ef56ab78',
    title: 'Systems Programming in Rust',
    subtitle: 'From zero to building network engines in Rust',
    description: 'Master ownership, borrowing, and high-concurrency systems in Rust.',
    primaryTopic: 'Rust',
    tags: ['Rust', 'Systems Programming', 'Concurrency'],
    categories: ['Engineering', 'Programming'],
    difficulty: 'INTERMEDIATE',
    language: 'en',
    coverImage: 'https://images.unsplash.com/photo-rust.jpg',
    creator: { name: 'Ferris the Crab' },
    publishedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    seasons: [
      {
        id: 's1',
        title: 'Foundations',
        lessons: [
          { id: 'l1', title: 'Memory Safety', lessonType: 'VIDEO' },
          { id: 'l2', title: 'Lifetimes in Practice', lessonType: 'ARTICLE' },
        ],
      },
    ],
  };

  const mockSeo = {
    version: 1 as const,
    metaTitle: 'Master Systems Programming in Rust',
    metaDescription: 'Hands-on curriculum for building memory-safe systems in Rust.',
    primaryKeyword: 'Rust Systems Programming',
    keywords: ['Rust Systems Programming', 'Memory Safety', 'Concurrency', 'online course'],
    concepts: ['Memory Safety', 'Lifetimes', 'Borrow Checker'],
    teaches: ['Understand Memory Safety', 'Master Lifetimes'],
    timeRequired: 'PT3H30M',
    outline: [{ title: 'Curriculum', lessons: ['Memory Safety', 'Lifetimes in Practice'] }],
    keyMoments: [{ name: 'Memory Model', startSeconds: 120, videoId: 'dQw4w9WgXcQ' }],
    faq: [{ q: 'Is Rust difficult?', a: 'Rust has a steep learning curve, but this cohort breaks it down step by step.' }],
    ogAlt: 'Systems Programming in Rust - cover image',
  };

  it('builds absolute metadata with canonical url without double | Undone', () => {
    const meta = buildCohortMetadata(mockDbRow, mockSeo, 'overview');
    expect(meta.title).toEqual({ absolute: 'Master Systems Programming in Rust | Undone' });
    expect(meta.description).toBe(mockSeo.metaDescription);
    expect(meta.alternates?.canonical).toBe(
      `https://undone.in/cohort/${mockDbRow.id}/overview`
    );
    expect(meta.robots).toMatchObject({ index: true, follow: true });
    expect(meta.openGraph?.title).toBe('Master Systems Programming in Rust');
    expect((meta.twitter as any)?.card).toBe('summary_large_image');
  });

  it('builds questline metadata with Curriculum suffix', () => {
    const meta = buildCohortMetadata(mockDbRow, mockSeo, 'questline');
    expect(meta.title).toEqual({ absolute: 'Master Systems Programming in Rust - Curriculum | Undone' });
    expect(meta.alternates?.canonical).toBe(
      `https://undone.in/cohort/${mockDbRow.id}/questline`
    );
  });

  it('builds Schema.org Course, BreadcrumbList, and FAQPage graphs', () => {
    const graph = buildCohortJsonLd(mockDbRow, mockSeo);
    expect(Array.isArray(graph)).toBe(true);

    const course = graph.find((item: any) => item['@type'] === 'Course') as any;
    expect(course).toBeDefined();
    expect(course.name).toBe(mockDbRow.title);
    expect(course.isAccessibleForFree).toBe(true);
    expect(course.hasCourseInstance.courseWorkload).toBe('PT3H30M');
    expect(course.hasPart).toHaveLength(2);

    // CRITICAL: NEVER include fake ratings or reviews
    expect(course.aggregateRating).toBeUndefined();
    expect(course.review).toBeUndefined();

    const breadcrumbs = graph.find((item: any) => item['@type'] === 'BreadcrumbList') as any;
    expect(breadcrumbs).toBeDefined();
    expect(breadcrumbs.itemListElement).toHaveLength(3);

    const faq = graph.find((item: any) => item['@type'] === 'FAQPage') as any;
    expect(faq).toBeDefined();
    expect(faq.mainEntity).toHaveLength(1);
    expect(faq.mainEntity[0].name).toBe('Is Rust difficult?');
  });

  it('serializes JSON-LD safely and escapes closing script tags and unicode separators', () => {
    const dangerous = { title: '</script><script>alert("xss")</script>', special: '\u2028\u2029' };
    const serialized = serializeJsonLd(dangerous);
    expect(serialized).not.toContain('</script>');
    expect(serialized).toContain('\\u003c/script>');
    expect(serialized).not.toContain('\u2028');
  });

  it('provides NOINDEX_METADATA for placeholder tabs', () => {
    expect(NOINDEX_METADATA.robots).toEqual({ index: false, follow: true });
  });
});
