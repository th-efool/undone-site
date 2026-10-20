// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { CohortHero } from '../CohortHero';
import type { Cohort } from '../../../models';

const mockCohort: Cohort = {
  id: 'cohort-1',
  title: 'Systems Programming in Rust',
  subtitle: 'Master low-level systems',
  description: 'Deep dive into memory safety and systems.',
  coverImage: 'https://images.unsplash.com/photo-rust',
  difficulty: 'INTERMEDIATE',
  categories: [{ id: 'cat-1', label: 'Systems' }],
  creator: {
    id: 'creator-1',
    name: 'Ada Lovelace',
    role: 'Lead Architect',
    avatarUrl: '/avatars/ada.webp',
  },
  overview: {
    about: 'Learn Rust from first principles.',
    journeySummary: [{ id: 'js-1', label: 'Duration', value: '4 weeks' }],
    milestones: [],
    prerequisites: [],
  },
  stats: {
    explorerCount: 1420,
    rating: 4.9,
    completionRate: 88,
  },
  progress: {
    journeyProgress: 45,
    dailyGoal: '30 min/day',
  },
  questline: {
    seasons: [
      {
        id: 'season-1',
        title: 'Foundations',
        lessons: [
          {
            id: 'lesson-1',
            title: 'Ownership and Borrowing',
            duration: '20 min',
            status: 'inStream',
          },
        ],
      },
    ],
  },
} as unknown as Cohort;

describe('CohortHero', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the cover image with priority and fetchPriority="high"', () => {
    const { container } = render(<CohortHero cohort={mockCohort} />);
    const images = container.querySelectorAll('img');
    const artImage = Array.from(images).find((img) =>
      img.getAttribute('src')?.includes('photo-rust'),
    );

    expect(artImage).toBeTruthy();
    expect(artImage?.getAttribute('fetchpriority')).toBe('high');
  });

  it('renders cohort title and creator details', () => {
    render(<CohortHero cohort={mockCohort} />);
    expect(screen.getByRole('heading', { name: 'Systems Programming in Rust' })).toBeTruthy();
    expect(screen.getByText('Led by Ada Lovelace')).toBeTruthy();
  });
});
