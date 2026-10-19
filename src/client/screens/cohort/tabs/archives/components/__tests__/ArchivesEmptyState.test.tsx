// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { ArchiveFeed } from '../ArchiveFeed/ArchiveFeed';
import { ArchivesPage } from '../ArchivesPage/ArchivesPage';
import type { CohortArchives } from '../../../../models';

describe('Archives Empty State & Pagination (ArchiveFeed & ArchivesPage)', () => {
  afterEach(() => {
    cleanup();
  });

  const baseArchives: CohortArchives = {
    title: 'Knowledge Archives',
    description: 'Explore shared resources, notes, and community knowledge.',
    categories: [{ id: 'all', label: 'All Resources', active: true }],
    sortControls: [{ id: 'recent', label: 'Recently Added' }],
    items: [],
    contributors: [],
    trending: [],
    shareKnowledge: {
      title: 'Share Knowledge',
      description: 'Got a helpful resource?',
      buttonLabel: 'Contribute',
      illustration: '',
    },
  };

  it('renders clean empty state notice in ArchiveFeed when items is empty', () => {
    render(<ArchiveFeed items={[]} />);

    expect(screen.getByText('No community archives yet')).toBeTruthy();
    expect(
      screen.getByText(/Share your first mindmap, cheatsheet, or field note/i),
    ).toBeTruthy();
  });

  it('hides "Load More" button when archives has less than 10 items', () => {
    render(<ArchivesPage archives={baseArchives} />);

    expect(screen.getByText('No community archives yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('renders "Load More" button when archives has 10 or more items', () => {
    const items: any[] = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      title: `Archive Resource ${i + 1}`,
      thumbnail: '/mock/covers/cohort-cover.webp',
      description: `Description for resource ${i + 1}`,
      author: { name: 'Explorer', avatarUrl: '/mock/avatars/a.webp' },
      publishedAt: 'Oct 15, 2026',
      commentCount: 3,
      voteCount: 12,
      type: 'Mind Map' as any,
    }));

    render(<ArchivesPage archives={{ ...baseArchives, items }} />);

    expect(screen.getByRole('button', { name: /load more/i })).toBeTruthy();
    expect(screen.queryByText('No community archives yet')).toBeNull();
    expect(screen.getByText('Archive Resource 1')).toBeTruthy();
    expect(screen.getByText('Archive Resource 10')).toBeTruthy();
  });
});
