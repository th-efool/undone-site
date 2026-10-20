import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import EventsPage, { metadata } from '../page';
import { PrivateEvents } from '../PrivateEvents';
import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { getPrivateCohortContext } from '../../privateCohortCache';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { notFound } from 'next/navigation';
import { Events } from '@/src/client/screens/cohort';

vi.mock('@/src/server/domain/cohort/public-cohort', () => ({
  getPublicCohort: vi.fn(),
}));

vi.mock('../../privateCohortCache', () => ({
  getPrivateCohortContext: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/mappers/cohortMapper', () => ({
  mapDbCohortToUiCohort: vi.fn((dbCohort) => ({
    id: dbCohort.id,
    title: dbCohort.title,
    mapped: true,
  })),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/src/client/screens/cohort', () => ({
  Events: vi.fn(() => null),
}));

describe('Events Page (Edge ISR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('preserves noindex metadata and title', () => {
      expect(metadata.title).toBe('Events');
      expect(metadata.robots).toEqual({
        index: false,
        follow: true,
      });
    });
  });

  describe('EventsPage', () => {
    it('renders Events directly with mapped cohort when public cohort exists (ISR hit)', async () => {
      const mockPublicCohort = {
        row: {
          id: 'public-c1',
          title: 'Public Systems Cohort',
        },
        seo: null,
      };

      vi.mocked(getPublicCohort).mockResolvedValue(mockPublicCohort as any);

      const params = Promise.resolve({ cohortId: 'public-c1' });
      const element = await EventsPage({ params });

      expect(getPublicCohort).toHaveBeenCalledWith('public-c1');
      expect(mapDbCohortToUiCohort).toHaveBeenCalledWith(mockPublicCohort.row);
      expect(element.type).toBe(Events);
      expect(element.props).toEqual({
        cohortId: 'public-c1',
        cohort: {
          id: 'public-c1',
          title: 'Public Systems Cohort',
          mapped: true,
        },
      });
    });

    it('renders PrivateEvents fallback when public cohort is not found', async () => {
      vi.mocked(getPublicCohort).mockResolvedValue(null);

      const params = Promise.resolve({ cohortId: 'private-c1' });
      const element = await EventsPage({ params });

      expect(getPublicCohort).toHaveBeenCalledWith('private-c1');
      expect(element.type).toBe(PrivateEvents);
      expect(element.props).toEqual({
        cohortId: 'private-c1',
      });
    });
  });

  describe('PrivateEvents', () => {
    it('renders Events when private cohort context returns dbCohort', async () => {
      const mockDbCohort = {
        id: 'private-c1',
        title: 'Private Advanced Cohort',
      };

      vi.mocked(getPrivateCohortContext).mockResolvedValue({
        userId: 'user-1',
        isLoggedIn: true,
        isEnrolled: true,
        dbCohort: mockDbCohort as any,
      });

      const element = await PrivateEvents({ cohortId: 'private-c1' });

      expect(getPrivateCohortContext).toHaveBeenCalledWith('private-c1');
      expect(mapDbCohortToUiCohort).toHaveBeenCalledWith(mockDbCohort);
      expect(element.type).toBe(Events);
      expect(element.props).toEqual({
        cohortId: 'private-c1',
        cohort: {
          id: 'private-c1',
          title: 'Private Advanced Cohort',
          mapped: true,
        },
      });
    });

    it('calls notFound() when neither public nor private cohort exists', async () => {
      vi.mocked(getPrivateCohortContext).mockResolvedValue({
        userId: null,
        isLoggedIn: false,
        isEnrolled: false,
        dbCohort: null,
      });

      await expect(PrivateEvents({ cohortId: 'non-existent' })).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFound).toHaveBeenCalledTimes(1);
    });
  });
});
