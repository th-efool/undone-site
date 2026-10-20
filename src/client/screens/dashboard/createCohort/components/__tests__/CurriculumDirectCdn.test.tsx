/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurriculumBoard } from '../CurriculumBoard/CurriculumBoard';
import { CurriculumInspector } from '../CurriculumInspector/CurriculumInspector';

const mockActions = {
  toggleSelectLesson: vi.fn(),
  selectLesson: vi.fn(),
  selectSeason: vi.fn(),
  updateLesson: vi.fn(),
  updateSeason: vi.fn(),
  moveLesson: vi.fn(),
  moveSeason: vi.fn(),
  reorderLessons: vi.fn(),
};

const mockCurriculumState = {
  searchQuery: '',
  filterWarningOnly: false,
  selectedLessonId: 'l1' as string | null,
  selectedSeasonId: null as string | null,
  multiSelection: {
    selectedLessonIds: [] as string[],
    selectedSeasonIds: [] as string[],
  },
  curriculum: {
    seasons: [
      {
        id: 's1',
        title: 'Season 1: Fundamentals',
        description: 'First season',
        lessons: [
          {
            id: 'l1',
            title: 'Video Lesson 1',
            description: 'Introduction to topic',
            duration: '15m',
            chunkCount: 3,
            videoId: 'yt-test-id-123',
            thumbnail: '',
            difficulty: 'Beginner',
            xp: 100,
            visualDependence: 'REQUIRES SCREEN',
            cognitiveLoad: 'STANDARD',
            pathway: 'CORE CURRICULUM',
            prerequisites: [],
            chunks: [],
          },
        ],
      },
    ],
    warnings: [],
  },
};

vi.mock('../../providers/WizardProvider', () => ({
  useWizardContext: () => ({
    curriculumState: mockCurriculumState,
    actions: mockActions,
  }),
}));

afterEach(cleanup);

describe('Curriculum Direct CDN Thumbnail Loading', () => {
  it('CurriculumBoard renders direct YouTube CDN thumbnail with unoptimized prop (bypassing /_next/image)', () => {
    const { container } = render(<CurriculumBoard />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://i.ytimg.com/vi/yt-test-id-123/hqdefault.jpg');
    expect(img?.getAttribute('src')).not.toContain('/_next/image');
  });

  it('CurriculumInspector renders direct YouTube CDN preview with unoptimized prop (bypassing /_next/image)', () => {
    const { container } = render(<CurriculumInspector />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://i.ytimg.com/vi/yt-test-id-123/hqdefault.jpg');
    expect(img?.getAttribute('src')).not.toContain('/_next/image');
  });
});
