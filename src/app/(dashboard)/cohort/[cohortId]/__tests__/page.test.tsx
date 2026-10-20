import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import CohortPage, { generateMetadata } from '../page';
import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { redirect } from 'next/navigation';

vi.mock('@/src/server/domain/cohort/public-cohort', () => ({
  getPublicCohort: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('Cohort Root Page (Redirect & Metadata ISR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMetadata', () => {
    it('generates rich metadata from public cohort when present', async () => {
      vi.mocked(getPublicCohort).mockResolvedValue({
        row: {
          id: 'c-101',
          title: 'Fullstack Rust Systems',
          description: 'Build fast engines with Rust.',
          coverImage: 'https://example.com/rust.png',
        },
        seo: null,
      } as any);

      const metadata = await generateMetadata({ params: Promise.resolve({ cohortId: 'c-101' }) });

      expect(getPublicCohort).toHaveBeenCalledWith('c-101');
      expect(metadata.title).toBe('Fullstack Rust Systems');
      expect(metadata.description).toBe('Build fast engines with Rust.');
      expect(metadata.openGraph?.title).toBe('Undone > Fullstack Rust Systems');
      expect(metadata.openGraph?.images).toEqual([{ url: 'https://example.com/rust.png' }]);
      expect(metadata.twitter?.images).toEqual(['https://example.com/rust.png']);
    });

    it('generates fallback metadata without dynamic auth when cohort is not public', async () => {
      vi.mocked(getPublicCohort).mockResolvedValue(null);

      const metadata = await generateMetadata({ params: Promise.resolve({ cohortId: 'private-99' }) });

      expect(getPublicCohort).toHaveBeenCalledWith('private-99');
      expect(metadata.title).toBe('Cohort private-99');
      expect(metadata.description).toBe('Explore this learning cohort on Undone.');
      expect(metadata.openGraph?.title).toBe('Undone > Cohort private-99');
      expect(metadata.openGraph?.images).toBeUndefined();
      expect(metadata.twitter?.images).toBeUndefined();
    });
  });

  describe('CohortPage', () => {
    it('redirects to /cohort/[cohortId]/overview', async () => {
      await expect(CohortPage({ params: Promise.resolve({ cohortId: 'cohort-xyz' }) })).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/cohort/cohort-xyz/overview');
    });
  });
});
