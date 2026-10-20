import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

vi.mock('server-only', () => ({}));

const notFoundMock = vi.fn();
vi.mock('next/navigation', () => ({
  notFound: () => {
    notFoundMock();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/src/server/domain/cohort/public-cohort', () => ({
  getPublicCohort: vi.fn(),
}));

vi.mock('../../privateCohortCache', () => ({
  getPrivateCohortContext: vi.fn(),
}));

vi.mock('@/src/client/screens/cohort', () => ({
  HallOfFame: (props: any) => <div data-testid="hall-of-fame" {...props} />,
}));

import HallOfFamePage, { metadata } from '../page';
import { PrivateHallOfFame } from '../PrivateHallOfFame';
import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { getPrivateCohortContext } from '../../privateCohortCache';
import { NOINDEX_METADATA } from '@/src/server/domain/cohort/cohort-seo-render';

describe('HallOfFame Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('exports NOINDEX_METADATA and sets title to "Hall of Fame"', () => {
      expect(metadata.title).toBe('Hall of Fame');
      expect(metadata.robots).toEqual(NOINDEX_METADATA.robots);
    });
  });

  describe('HallOfFamePage Server Component', () => {
    it('renders HallOfFame directly when cohort is public (cache hit)', async () => {
      const mockRow = {
        id: 'cohort-public-1',
        title: 'Public Algo Cohort',
        visibility: 'PUBLIC',
        seasons: [],
        categories: ['Algorithms'],
        creator: { id: 'c1', name: 'Turing' },
      };

      vi.mocked(getPublicCohort).mockResolvedValueOnce({
        row: mockRow as any,
        seo: null,
      });

      const element = await HallOfFamePage({
        params: Promise.resolve({ cohortId: 'cohort-public-1' }),
      });

      expect(getPublicCohort).toHaveBeenCalledWith('cohort-public-1');
      expect(element.props.cohortId).toBe('cohort-public-1');
      expect(element.props.cohort).toBeDefined();
      expect(element.props.cohort.title).toBe('Public Algo Cohort');
    });

    it('renders PrivateHallOfFame fallback when cohort is not public (cache miss / private)', async () => {
      vi.mocked(getPublicCohort).mockResolvedValueOnce(null);

      const element = await HallOfFamePage({
        params: Promise.resolve({ cohortId: 'cohort-private-1' }),
      });

      expect(getPublicCohort).toHaveBeenCalledWith('cohort-private-1');
      expect(element.type).toBe(PrivateHallOfFame);
      expect(element.props).toEqual({ cohortId: 'cohort-private-1' });
    });
  });

  describe('PrivateHallOfFame Component', () => {
    it('triggers notFound() when private cohort is not accessible or does not exist', async () => {
      vi.mocked(getPrivateCohortContext).mockResolvedValueOnce({
        userId: 'user-1',
        isLoggedIn: true,
        isEnrolled: false,
        dbCohort: null,
      });

      await expect(PrivateHallOfFame({ cohortId: 'cohort-missing' })).rejects.toThrow('NEXT_NOT_FOUND');
      expect(getPrivateCohortContext).toHaveBeenCalledWith('cohort-missing');
      expect(notFoundMock).toHaveBeenCalledTimes(1);
    });

    it('renders HallOfFame when private cohort exists and user has access', async () => {
      const mockDbCohort = {
        id: 'cohort-private-1',
        title: 'Secret Internal Cohort',
        visibility: 'PRIVATE',
        seasons: [],
        creator: { id: 'c2', name: 'Hopper' },
      };

      vi.mocked(getPrivateCohortContext).mockResolvedValueOnce({
        userId: 'user-1',
        isLoggedIn: true,
        isEnrolled: true,
        dbCohort: mockDbCohort as any,
      });

      const element = await PrivateHallOfFame({ cohortId: 'cohort-private-1' });

      expect(getPrivateCohortContext).toHaveBeenCalledWith('cohort-private-1');
      expect(notFoundMock).not.toHaveBeenCalled();
      expect(element.props.cohortId).toBe('cohort-private-1');
      expect(element.props.cohort).toBeDefined();
      expect(element.props.cohort.title).toBe('Secret Internal Cohort');
    });
  });
});
