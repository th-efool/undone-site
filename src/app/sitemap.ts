import type { MetadataRoute } from 'next';
import { listPublicCohortsForSitemap } from '@/src/server/domain/cohort/public-cohort';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://undone.in').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  let publicCohorts: Array<{ id: string; updatedAt: Date; publishedAt: Date | null }> = [];
  try {
    publicCohorts = await listPublicCohortsForSitemap(5000);
  } catch (error) {
    console.error('Failed to list public cohorts for sitemap:', error);
  }

  const cohortRoutes: MetadataRoute.Sitemap = publicCohorts.flatMap((cohort) => {
    const lastModified = cohort.updatedAt || cohort.publishedAt || currentDate;
    return [
      {
        url: `${BASE_URL}/cohort/${cohort.id}/overview`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: `${BASE_URL}/cohort/${cohort.id}/questline`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.6,
      },
    ];
  });

  return [...staticRoutes, ...cohortRoutes];
}

