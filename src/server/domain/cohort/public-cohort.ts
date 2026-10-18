import 'server-only';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { cohortSeoSchema, type CohortSeo } from '@/src/shared/cohort-builder/seo';

export const PUBLIC_COHORT_REVALIDATE = 3600;
export const cohortTag = (id: string) => `cohort:${id}`;
const where = (id: string) => ({ id, isPublished: true, visibility: 'PUBLIC' as const });

const load = (id: string) => unstable_cache(async () => {
  const row = await prisma.cohort.findFirst({
    where: where(id),
    include: { creator: true, seasons: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } } },
  });
  return row ? JSON.parse(JSON.stringify(row)) : null; // JSON-safe: Dates become ISO strings
}, ['public-cohort', id], { revalidate: PUBLIC_COHORT_REVALIDATE, tags: [cohortTag(id)] })();

/** Deduped per request, cached across requests, NEVER reads cookies/session. */
export const getPublicCohort = cache(async (id: string) => {
  const row = await load(id);
  if (!row) return null;
  const parsed = cohortSeoSchema.safeParse((row.creationSettings as { seo?: unknown } | null)?.seo);
  return { row, seo: (parsed.success ? parsed.data : null) as CohortSeo | null };
});

export async function listPublicCohortsForSitemap(limit = 5000) {
  return prisma.cohort.findMany({
    where: { isPublished: true, visibility: 'PUBLIC' },
    select: { id: true, updatedAt: true, publishedAt: true },
    orderBy: { updatedAt: 'desc' }, take: limit,
  });
}
