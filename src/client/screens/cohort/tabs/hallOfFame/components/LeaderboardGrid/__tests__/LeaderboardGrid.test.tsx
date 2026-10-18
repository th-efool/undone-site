// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LeaderboardGrid } from '../LeaderboardGrid';

describe('LeaderboardGrid (HallOfFame)', () => {
  it('renders "Be the first champion" banner when categories array is empty', () => {
    render(<LeaderboardGrid items={[]} />);

    expect(screen.getByText(/Be the first champion/i)).toBeTruthy();
    expect(
      screen.getByText(/No explorers have completed this cohort yet/i),
    ).toBeTruthy();
  });

  it('renders leaderboard cards when categories are provided', () => {
    const categories = [
      {
        id: 'cat-1',
        title: 'Top Explorer',
        subtitle: 'Most active learner',
        rank: 1,
        winner: { name: 'Grace Hopper', avatarUrl: '/avatars/grace.webp' },
        primaryMetric: '350 XP',
        growthMetric: '+15%',
        badge: 'champion',
        accent: 'amber' as const,
      },
    ];

    render(<LeaderboardGrid items={categories} />);

    expect(screen.getByText('Top Explorer')).toBeTruthy();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.getByText('350 XP')).toBeTruthy();
  });
});
