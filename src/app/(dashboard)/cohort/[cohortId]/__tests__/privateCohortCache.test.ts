import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { getPrivateCohortContext } from '../privateCohortCache';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    $transaction: vi.fn(),
    cohortMember: {
      findUnique: vi.fn(),
    },
    cohort: {
      findFirst: vi.fn(),
    },
  },
}));

describe('getPrivateCohortContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('batches member check and cohort query into a single prisma.$transaction when user is logged in', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-42', email: 'test@example.com' },
    } as any);

    const mockMember = { cohortId: 'cohort-100' };
    const mockCohort = {
      id: 'cohort-100',
      title: 'Type-Safe Distributed Systems',
      creator: { id: 'creator-1', name: 'Lamport' },
      seasons: [],
    };

    vi.mocked(prisma.$transaction).mockResolvedValue([mockMember, mockCohort] as any);

    const context = await getPrivateCohortContext('cohort-100');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.cohortMember.findUnique).toHaveBeenCalledWith({
      where: {
        cohortId_userId: {
          cohortId: 'cohort-100',
          userId: 'user-42',
        },
      },
      select: { cohortId: true },
    });
    expect(prisma.cohort.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'cohort-100' }),
      select: expect.objectContaining({
        id: true,
        title: true,
        creator: expect.objectContaining({
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            bio: true,
          },
        }),
        seasons: expect.objectContaining({
          orderBy: { order: 'asc' },
          select: expect.objectContaining({
            id: true,
            title: true,
            order: true,
            lessons: expect.any(Object),
          }),
        }),
      }),
    });

    expect(context).toEqual({
      userId: 'user-42',
      isLoggedIn: true,
      isEnrolled: true,
      dbCohort: mockCohort,
    });
  });

  it('executes direct pruned cohort.findFirst without transaction when user is not logged in', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const mockCohort = {
      id: 'cohort-public',
      title: 'Public Cohort',
      creator: { id: 'c-1', name: 'Guide' },
      seasons: [],
    };

    vi.mocked(prisma.cohort.findFirst).mockResolvedValue(mockCohort as any);

    const context = await getPrivateCohortContext('cohort-public');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.cohortMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.cohort.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'cohort-public' }),
      select: expect.objectContaining({
        id: true,
        title: true,
        creator: expect.any(Object),
        seasons: expect.any(Object),
      }),
    });

    expect(context).toEqual({
      userId: null,
      isLoggedIn: false,
      isEnrolled: false,
      dbCohort: mockCohort,
    });
  });
});
