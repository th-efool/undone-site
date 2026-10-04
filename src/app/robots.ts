import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sidequesthq.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/features/microlearning',
          '/features/ai-study-planner',
          '/cohort/*',
          '/policy',
          '/terms',
          '/auth',
        ],
        disallow: [
          '/api/',
          '/studyroom/',
          '/notes/',
          '/message/',
          '/create-cohort',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/studyroom/', '/notes/'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/api/', '/studyroom/', '/notes/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
