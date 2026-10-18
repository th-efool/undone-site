import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error(`NEXT_REDIRECT: ${url}`);
  },
}));

import CohortIndexPage, { metadata } from '../page';

describe('CohortIndexPage (src/app/(dashboard)/cohort/page.tsx)', () => {
  it('exports correct metadata for SEO crawlers', () => {
    expect(metadata.title).toBe('Cohorts | Undone');
    expect(metadata.description).toBe('View and manage your Undone cohorts.');
    expect(metadata.openGraph).toMatchObject({
      title: 'Cohorts | Undone',
      description: 'View and manage your Undone cohorts.',
      type: 'website',
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Cohorts | Undone',
      description: 'View and manage your Undone cohorts.',
    });
  });

  it('immediately triggers server redirect to /explore', async () => {
    redirectMock.mockClear();

    await expect(CohortIndexPage()).rejects.toThrow('NEXT_REDIRECT: /explore');
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith('/explore');
  });
});
