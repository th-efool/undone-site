import 'server-only';
import { prisma } from '../client';
import { existingCohortSchema, type ExistingCohortReference, type LearningIntent } from '@/src/shared/cohort-creation/contracts';

const stopWords = new Set(['want', 'learn', 'learning', 'about', 'with', 'have', 'would', 'like', 'the', 'and', 'for']);
export function candidateSearchTerms(intent: LearningIntent): string[] {
  const terms = [intent.topic.value, ...intent.searchTerms, ...intent.rawQuery.split(/\s+/)]
    .map(term => term.trim().slice(0, 80))
    .filter(term => term.length >= 2 && !stopWords.has(term.toLowerCase()));
  return [...new Set(terms)].slice(0, 12);
}

export const creationRecommendationRepo = {
  async findCandidates(intent: LearningIntent, signal: AbortSignal): Promise<ExistingCohortReference[]> {
    signal.throwIfAborted();
    const terms = candidateSearchTerms(intent);
    if (!terms.length) return [];
    const rows = await prisma.cohort.findMany({
      where: {
        isPublished: true, visibility: 'PUBLIC',
        OR: terms.flatMap(term => [
          { title: { contains: term, mode: 'insensitive' as const } },
          { description: { contains: term, mode: 'insensitive' as const } },
          { primaryTopic: { contains: term, mode: 'insensitive' as const } },
        ]),
      },
      take: 50, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true, title: true, description: true, coverImage: true,
        difficulty: true, categories: true, estimatedCompletionTime: true,
        creator: { select: { name: true } },
        _count: { select: { members: true } },
        seasons: { select: { _count: { select: { lessons: true } } } },
      },
    });
    // Prisma doesn't expose request cancellation; prevent a late query from being accepted.
    signal.throwIfAborted();
    return rows.map(row => existingCohortSchema.parse({
      cohortId: row.id, title: row.title, description: row.description ?? '',
      coverImage: row.coverImage, creatorName: row.creator.name,
      difficulty: row.difficulty, categories: row.categories,
      estimatedCompletionTime: row.estimatedCompletionTime,
      memberCount: row._count.members,
      lessonCount: row.seasons.reduce((sum, season) => sum + season._count.lessons, 0),
      visibility: 'PUBLIC', isPublished: true,
    }));
  },
  async retainEligible(ids: string[], signal: AbortSignal): Promise<Set<string>> {
    signal.throwIfAborted();
    const rows = await prisma.cohort.findMany({
      where: { id: { in: ids }, isPublished: true, visibility: 'PUBLIC' },
      select: { id: true },
    });
    signal.throwIfAborted();
    return new Set(rows.map(row => row.id));
  },
};
