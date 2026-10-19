/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlayHeader } from '../PlayHeader';
import type { UsePlaybackResult } from '../../../hooks/usePlayback';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockItem: FeedItem = {
  chunkId: 'chunk-1',
  lessonId: 'lesson-1',
  lessonTitle: 'Mastering AI Orchestration',
  chunkTitle: 'Attention Mechanisms',
  chunkOrder: 1,
  chunkDuration: '4m',
  startSeconds: 0,
  endSeconds: 240,
  lessonType: 'video',
  lessonVideoId: 'dQw4w9WgXcQ',
  cohortId: 'cohort-1',
  cohortTitle: 'AI Engineering 2026',
  matchScore: 1,
};

const createMockPlayback = (overrides?: Partial<UsePlaybackResult>): UsePlaybackResult => {
  return {
    activeItem: mockItem,
    feedLoading: false,
    isRefreshing: false,
    feedError: false,
    feedItems: [
      mockItem,
      { ...mockItem, chunkId: 'chunk-2', chunkOrder: 2 },
      { ...mockItem, chunkId: 'chunk-3', chunkOrder: 3 },
      { ...mockItem, chunkId: 'chunk-4', chunkOrder: 4 },
    ],
    currentIndex: 1,
    lesson: {
      platform: 'youtube',
      title: 'Mastering AI Orchestration',
      subtitle: '',
      cohortTitle: 'AI Engineering 2026',
      cohortId: 'cohort-1',
      seasonOrder: 1,
      seasonNumber: 1,
      currentChunk: 2,
      totalChunks: 4,
      currentVideo: 8,
      totalVideos: 10,
      startTime: '00:00',
      endTime: '04:00',
      currentTime: '01:30',
      totalDuration: '04:00',
      videoId: 'dQw4w9WgXcQ',
    },
    timelineMarkers: [],
    timelineProgress: 50,
    hasNext: true,
    hasPrevious: true,
    isPlaying: false,
    volume: 90,
    muted: false,
    playbackSpeed: 1,
    bookmarked: false,
    activeTool: null,
    notesText: '',
    dailyGoalPercent: 40,
    stats: { cohortsCovered: 1, chunksRemaining: 3, estimatedMinutes: 12 },
    playerContainerRef: { current: null },
    setCurrentIndex: vi.fn(),
    goToIndex: vi.fn(),
    nextChunk: vi.fn(),
    previousChunk: vi.fn(),
    togglePlayback: vi.fn(),
    seekToPercent: vi.fn(),
    skipSeconds: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setPlaybackSpeed: vi.fn(),
    toggleBookmark: vi.fn(),
    completeActiveChunk: vi.fn().mockResolvedValue(true),
    completionPending: false,
    completionError: null,
    saveNotes: vi.fn(),
    setActiveTool: vi.fn(),
    ytApiReady: true,
    ytApiError: null,
    mediaError: null,
    setMediaError: vi.fn(),
    registerVideoElement: vi.fn(),
    videoRef: { current: null },
    isPlayerReady: true,
    itemStatuses: ['completed', 'not-started', 'not-started', 'not-started'],
    isChunkCompleted: vi.fn((chunkId) => chunkId === 'chunk-1'),
    activeChannel: 'default',
    setActiveChannel: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    fetchChannelFeed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

describe('PlayHeader component', () => {
  it('renders top position capsules and invokes goToIndex on click', () => {
    const goToIndex = vi.fn();
    const playback = createMockPlayback({ goToIndex });

    render(<PlayHeader playback={playback} />);

    const capsules = screen.getAllByRole('button', { name: /jump to lesson/i });
    expect(capsules.length).toBe(4);

    // Index 1 should be active
    expect(capsules[1].getAttribute('aria-current')).toBe('step');
    expect(capsules[0].getAttribute('aria-current')).toBeNull();

    // Clicking capsule 3 calls goToIndex(2)
    fireEvent.click(capsules[2]);
    expect(goToIndex).toHaveBeenCalledWith(2);
  });

  it('renders lesson title, YouTube provider badge, fit scores, chunk order, and time range', () => {
    const playback = createMockPlayback({
      activeItem: {
        ...mockItem,
        channelFitScore: 92,
        overallFitScore: 88,
      },
    });
    render(<PlayHeader playback={playback} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Mastering AI Orchestration' })).toBeDefined();
    expect(screen.getByText('YouTube')).toBeDefined();
    expect(screen.getByText('92% Channel')).toBeDefined();
    expect(screen.getByText('88% Overall')).toBeDefined();
    expect(screen.getByText('Chunk 2 of 4')).toBeDefined();
    expect(screen.getByText('00:00 - 04:00')).toBeDefined();
  });

  it('renders circular progress ring and episode information honestly', () => {
    const playback = createMockPlayback();
    render(<PlayHeader playback={playback} />);

    expect(screen.getByText('S1:E8')).toBeDefined();
    expect(screen.getByText('Episode 8 of 10')).toBeDefined();

    // 1 of 4 completed = 25% course completion
    // circumference = 2 * PI * 18 ≈ 113.097
    // strokeDashoffset for 25% = 113.097 * 0.75 ≈ 84.82
    const indicator = document.querySelector('[class*="progressRingIndicator"]');
    expect(indicator).not.toBeNull();
    const dashoffset = parseFloat(indicator?.getAttribute('stroke-dashoffset') || '0');
    expect(dashoffset).toBeGreaterThan(80);
    expect(dashoffset).toBeLessThan(90);
  });

  it('windows capsule row to a max of 8 items when feed has many chunks', () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      ...mockItem,
      chunkId: `chunk-${i}`,
      chunkOrder: i + 1,
    }));

    const playback = createMockPlayback({
      feedItems: manyItems,
      currentIndex: 7,
    });

    render(<PlayHeader playback={playback} />);

    const capsules = screen.getAllByRole('button', { name: /jump to lesson/i });
    expect(capsules.length).toBe(8);
  });
});
