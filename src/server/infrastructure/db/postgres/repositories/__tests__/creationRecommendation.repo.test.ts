import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: { cohort: { findMany } } }));
import { creationRecommendationRepo } from '../creationRecommendation.repo';
import { candidate, intent } from '@/src/shared/cohort-creation/__tests__/fixtures';

describe('creation candidate database policy', () => {
  it('filters public/published records, bounds retrieval and derives actual counts', async () => {
    findMany.mockReset();
    findMany.mockResolvedValueOnce([{
      id: candidate.cohortId, title: candidate.title, description: candidate.description,
      coverImage: null, difficulty: 'BEGINNER', categories: [], estimatedCompletionTime: null,
      creator: { name: 'Ada' }, _count: { members: 7 },
      seasons: [{ _count: { lessons: 2 } }, { _count: { lessons: 1 } }],
    }]);
    const result = await creationRecommendationRepo.findCandidates(intent, new AbortController().signal);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isPublished: true, visibility: 'PUBLIC' }), take: 50 }));
    expect(result[0]).toMatchObject({ memberCount: 7, lessonCount: 3 });
  });
  it('rechecks only selected IDs using the same visibility policy', async () => {
    findMany.mockReset(); findMany.mockResolvedValueOnce([{ id: candidate.cohortId }]);
    expect(await creationRecommendationRepo.retainEligible([candidate.cohortId], new AbortController().signal)).toEqual(new Set([candidate.cohortId]));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [candidate.cohortId] }, isPublished: true, visibility: 'PUBLIC' } }));
  });
});
