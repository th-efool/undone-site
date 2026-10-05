import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://undone.in';

const FEATURED_COHORT_SLUGS = [
  'deep-work',
  'reader',
  'body-double',
  'content-bottle',
  '100-days',
  'journaling',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date();

  // Core static marketing and informational pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/features/microlearning`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/features/ai-study-planner`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/policy`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Public Cohort exploration pages
  const cohortRoutes: MetadataRoute.Sitemap = FEATURED_COHORT_SLUGS.map((slug) => ({
    url: `${BASE_URL}/cohort/${slug}`,
    lastModified: currentDate,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...cohortRoutes];
}
