import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  publishCohort: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: mocks.auth,
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/user.repo', () => ({
  userRepo: {
    findById: mocks.findById,
    findByEmail: mocks.findByEmail,
  },
}));

vi.mock('@/src/server/domain/cohort/cohort.service', () => ({
  CohortService: {
    publishCohort: mocks.publishCohort,
  },
}));

import { POST } from '../route';
import { cohortTag } from '@/src/server/domain/cohort/public-cohort';

const validPayload = {
  draft: {
    title: 'Valid Cohort Title',
    visibility: 'Public',
    sources: [],
  },
  curriculum: {
    seasons: [
      {
        title: 'Season 1',
        lessons: [
          {
            title: 'Lesson 1',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          },
        ],
      },
    ],
  },
};

describe('POST /api/cohort/publish Cache Revalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user-creator-1' } });
    mocks.findById.mockResolvedValue({ id: 'user-creator-1', name: 'Author' });
  });

  it('triggers revalidateTag with "max" and all subpage revalidatePath calls when published cohort is PUBLIC', async () => {
    const cohortId = 'cohort-public-xyz';
    mocks.publishCohort.mockResolvedValueOnce({
      id: cohortId,
      title: 'Valid Cohort Title',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      visibility: 'PUBLIC',
      coverImage: '/images/cover.webp',
    });

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Verify tag revalidation
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).toHaveBeenCalledWith(cohortTag(cohortId), 'max');

    // Verify all cohort paths and discovery catalogs were invalidated
    const expectedPaths = [
      `/cohort/${cohortId}`,
      `/cohort/${cohortId}/overview`,
      `/cohort/${cohortId}/questline`,
      `/cohort/${cohortId}/archives`,
      `/cohort/${cohortId}/events`,
      `/cohort/${cohortId}/hall-of-fame`,
      '/explore',
      '/sitemap.xml',
    ];

    expect(mocks.revalidatePath).toHaveBeenCalledTimes(expectedPaths.length);
    for (const path of expectedPaths) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it('does NOT trigger revalidateTag or revalidatePath when published cohort is PRIVATE', async () => {
    const cohortId = 'cohort-private-xyz';
    mocks.publishCohort.mockResolvedValueOnce({
      id: cohortId,
      title: 'Internal Cohort Title',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      visibility: 'PRIVATE',
      coverImage: '/images/cover.webp',
    });

    const privatePayload = {
      ...validPayload,
      draft: {
        ...validPayload.draft,
        visibility: 'Private',
      },
    };

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: JSON.stringify(privatePayload),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('catches cache revalidation errors gracefully and succeeds without failing publish', async () => {
    const cohortId = 'cohort-error-xyz';
    mocks.publishCohort.mockResolvedValueOnce({
      id: cohortId,
      title: 'Valid Cohort Title',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      visibility: 'PUBLIC',
      coverImage: '/images/cover.webp',
    });

    // Simulate an error thrown during revalidateTag
    mocks.revalidateTag.mockImplementationOnce(() => {
      throw new Error('Cache store offline');
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.cohortId).toBe(cohortId);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to revalidate cache on publish:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
