/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlayStage } from '../PlayStage';
import type { UsePlaybackResult } from '../../../hooks/usePlayback';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const videoItem: FeedItem = {
  chunkId: 'chunk-1',
  lessonId: 'lesson-1',
  lessonTitle: 'Neural Transformers Deep Dive',
  chunkTitle: 'Self-Attention Math',
  chunkOrder: 1,
  chunkDuration: '3m',
  startSeconds: 0,
  endSeconds: 180,
  lessonType: 'video',
  lessonVideoId: 'dQw4w9WgXcQ',
  lessonThumbnail: 'https://cdn.example.com/thumb1.jpg',
  cohortId: 'cohort-1',
  cohortTitle: 'AI Cohort',
  matchScore: 1,
};

const nextVideoItem: FeedItem = {
  ...videoItem,
  chunkId: 'chunk-2',
  chunkTitle: 'Multi-Head Projection',
  chunkOrder: 2,
  lessonThumbnail: 'https://cdn.example.com/thumb2.jpg',
};

const createMockPlayback = (overrides?: Partial<UsePlaybackResult>): UsePlaybackResult => {
  return {
    activeItem: videoItem,
    feedLoading: false,
    feedError: false,
    feedItems: [videoItem, nextVideoItem],
    currentIndex: 0,
    lesson: {
      platform: 'youtube',
      title: 'Neural Transformers Deep Dive',
      subtitle: '',
      cohortTitle: 'AI Cohort',
      cohortId: 'cohort-1',
      seasonOrder: 1,
      seasonNumber: 1,
      currentChunk: 1,
      totalChunks: 2,
      currentVideo: 1,
      totalVideos: 2,
      startTime: '00:00',
      endTime: '03:00',
      currentTime: '01:00',
      totalDuration: '03:00',
      videoId: 'dQw4w9WgXcQ',
    },
    timelineMarkers: [],
    timelineProgress: 33,
    hasNext: true,
    hasPrevious: false,
    isPlaying: false,
    volume: 90,
    muted: false,
    playbackSpeed: 1,
    bookmarked: false,
    activeTool: null,
    notesText: '',
    dailyGoalPercent: 50,
    stats: { cohortsCovered: 1, chunksRemaining: 1, estimatedMinutes: 3 },
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
    itemStatuses: ['not-started', 'not-started'],
    isChunkCompleted: vi.fn().mockReturnValue(false),
    activeChannel: 'default',
    setActiveChannel: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    fetchChannelFeed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

describe('PlayStage component', () => {
  it('renders central media surface and play overlay button when video is paused', () => {
    const togglePlayback = vi.fn();
    const playback = createMockPlayback({ isPlaying: false, togglePlayback });

    render(<PlayStage playback={playback} />);

    const playOverlay = screen.getByRole('button', { name: /play video/i });
    expect(playOverlay).toBeDefined();

    fireEvent.click(playOverlay);
    expect(togglePlayback).toHaveBeenCalledTimes(1);
  });

  it('renders right edge preview when hasNext is true and triggers nextChunk on click', () => {
    const nextChunk = vi.fn();
    const playback = createMockPlayback({ hasNext: true, nextChunk });

    render(<PlayStage playback={playback} />);

    const rightEdge = screen.getByRole('complementary', { name: /next lesson: multi-head projection/i });
    expect(rightEdge).toBeDefined();

    fireEvent.click(rightEdge);
    expect(nextChunk).toHaveBeenCalledTimes(1);
  });

  it('renders left edge preview when hasPrevious is true and triggers previousChunk on click', () => {
    const previousChunk = vi.fn();
    const playback = createMockPlayback({
      currentIndex: 1,
      hasPrevious: true,
      hasNext: false,
      previousChunk,
    });

    render(<PlayStage playback={playback} />);

    const leftEdge = screen.getByRole('complementary', { name: /previous lesson: self-attention math/i });
    expect(leftEdge).toBeDefined();

    fireEvent.click(leftEdge);
    expect(previousChunk).toHaveBeenCalledTimes(1);
  });

  it('provides accessible timeline scrubber with keyboard navigation', () => {
    const skipSeconds = vi.fn();
    const seekToPercent = vi.fn();
    const playback = createMockPlayback({ skipSeconds, seekToPercent });

    render(<PlayStage playback={playback} />);

    const scrubber = screen.getByRole('slider', { name: /timeline seek scrubber/i });
    expect(scrubber).toBeDefined();
    expect(scrubber.getAttribute('aria-valuenow')).toBe('33');

    // Right Arrow advances 10s
    fireEvent.keyDown(scrubber, { key: 'ArrowRight' });
    expect(skipSeconds).toHaveBeenCalledWith(10);

    // Left Arrow rewinds 10s
    fireEvent.keyDown(scrubber, { key: 'ArrowLeft' });
    expect(skipSeconds).toHaveBeenCalledWith(-10);

    // Home jumps to 0%
    fireEvent.keyDown(scrubber, { key: 'Home' });
    expect(seekToPercent).toHaveBeenCalledWith(0);

    // End jumps to 100%
    fireEvent.keyDown(scrubber, { key: 'End' });
    expect(seekToPercent).toHaveBeenCalledWith(100);
  });
});
