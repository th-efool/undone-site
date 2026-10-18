/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlayMobile } from '../PlayMobile';
import type { UsePlaybackResult } from '@/src/client/screens/dashboard/play/hooks/usePlayback';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const createMockPlayback = (overrides?: Partial<UsePlaybackResult>): UsePlaybackResult => {
  return {
    activeItem: {
      chunkId: 'chunk-1',
      lessonId: 'lesson-1',
      lessonTitle: 'Mobile Deep Learning Systems',
      chunkTitle: 'Quantization & Pruning',
      lessonType: 'video',
      lessonVideoId: 'dQw4w9WgXcQ',
      chunkIndex: 1,
      totalChunks: 5,
      cohortProvider: 'YouTube',
      channelId: 'default',
    } as any,
    feedLoading: false,
    feedError: false,
    feedItems: [
      {
        chunkId: 'chunk-1',
        lessonId: 'lesson-1',
        lessonTitle: 'Mobile Deep Learning Systems',
        chunkTitle: 'Quantization & Pruning',
        lessonType: 'video',
        lessonVideoId: 'dQw4w9WgXcQ',
      } as any,
      {
        chunkId: 'chunk-2',
        lessonId: 'lesson-1',
        lessonTitle: 'Mobile Deep Learning Systems',
        chunkTitle: 'Hardware Acceleration',
        lessonType: 'video',
        lessonVideoId: 'oHg5SJYRHA0',
      } as any,
    ],
    currentIndex: 0,
    lesson: {
      platform: 'youtube',
      title: 'Mobile Deep Learning Systems',
      subtitle: '',
      cohortTitle: 'AI Engineering',
      cohortId: 'cohort-1',
      seasonOrder: 1,
      seasonNumber: 1,
      currentChunk: 1,
      totalChunks: 5,
      currentVideo: 1,
      totalVideos: 3,
      startTime: '00:00',
      endTime: '05:00',
      currentTime: '01:30',
      totalDuration: '05:00',
      videoId: 'dQw4w9WgXcQ',
    },
    timelineMarkers: [],
    timelineProgress: 30,
    hasNext: true,
    hasPrevious: false,
    isPlaying: false,
    volume: 85,
    muted: false,
    playbackSpeed: 1.0,
    bookmarked: false,
    activeTool: null,
    notesText: '',
    dailyGoalPercent: 40,
    stats: { cohortsCovered: 1, chunksRemaining: 4, estimatedMinutes: 20 },
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
    completeActiveChunk: vi.fn().mockResolvedValue(undefined),
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
    activeChannel: 'default' as any,
    setActiveChannel: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    fetchChannelFeed: vi.fn(),
    ...overrides,
  };
};

describe('PlayMobile Screen', () => {
  it('renders loading skeleton when feedLoading is true', () => {
    const playback = createMockPlayback({ feedLoading: true });
    render(<PlayMobile playback={playback} />);
    expect(screen.getByRole('status', { name: /loading lessons/i })).toBeDefined();
  });

  it('renders feed error and triggers retry when feedError is true', () => {
    const fetchMock = vi.fn();
    const playback = createMockPlayback({
      feedError: true,
      fetchChannelFeed: fetchMock,
    });
    render(<PlayMobile playback={playback} />);
    const retryBtn = screen.getByRole('button', { name: /reload lessons/i });
    expect(retryBtn).toBeDefined();
    fireEvent.click(retryBtn);
    expect(fetchMock).toHaveBeenCalledWith('default', 0);
  });

  it('renders caught-up state when activeItem is null', () => {
    const playback = createMockPlayback({ activeItem: null as any });
    render(<PlayMobile playback={playback} />);
    expect(screen.getByText(/caught up with this selection/i)).toBeDefined();
  });

  it('renders video player, feed position capsules, and exact navigation', () => {
    const goToIndexMock = vi.fn();
    const playback = createMockPlayback({ goToIndex: goToIndexMock });
    render(<PlayMobile playback={playback} />);

    // Check title and chunk count
    expect(screen.getByText('Mobile Deep Learning Systems')).toBeDefined();
    expect(screen.getByText(/Chunk 1\/5/)).toBeDefined();

    // Check feed capsules (2 items in feedItems)
    const capsules = screen.getAllByRole('button', { name: /go to lesson chunk/i });
    expect(capsules.length).toBe(2);

    // Clicking capsule 2 calls goToIndex(1)
    fireEvent.click(capsules[1]);
    expect(goToIndexMock).toHaveBeenCalledWith(1);
  });

  it('handles play/pause toggle and skip controls', () => {
    const togglePlaybackMock = vi.fn();
    const skipSecondsMock = vi.fn();
    const playback = createMockPlayback({
      togglePlayback: togglePlaybackMock,
      skipSeconds: skipSecondsMock,
      isPlaying: false,
    });
    render(<PlayMobile playback={playback} />);

    // Centered overlay play button
    const overlayPlay = screen.getByRole('button', { name: 'Play video' });
    fireEvent.click(overlayPlay);
    expect(togglePlaybackMock).toHaveBeenCalled();

    // Skip forward 10s
    const fwdBtn = screen.getByRole('button', { name: /fast forward 10 seconds/i });
    fireEvent.click(fwdBtn);
    expect(skipSecondsMock).toHaveBeenCalledWith(10);

    // Rewind 10s
    const rewindBtn = screen.getByRole('button', { name: /rewind 10 seconds/i });
    fireEvent.click(rewindBtn);
    expect(skipSecondsMock).toHaveBeenCalledWith(-10);
  });

  it('handles chunk completion', () => {
    const completeMock = vi.fn().mockResolvedValue(undefined);
    const playback = createMockPlayback({ completeActiveChunk: completeMock });
    render(<PlayMobile playback={playback} />);

    const completeBtn = screen.getByRole('button', { name: /complete chunk/i });
    fireEvent.click(completeBtn);
    expect(completeMock).toHaveBeenCalled();
  });

  it('handles mute and unmute toggle', () => {
    const toggleMuteMock = vi.fn();
    const playback = createMockPlayback({
      muted: false,
      toggleMute: toggleMuteMock,
    });
    render(<PlayMobile playback={playback} />);

    const muteBtn = screen.getByRole('button', { name: /mute volume/i });
    fireEvent.click(muteBtn);
    expect(toggleMuteMock).toHaveBeenCalled();
  });

  it('opens tools drawer, adjusts playback speed, and toggles bookmark', () => {
    const setPlaybackSpeedMock = vi.fn();
    const toggleBookmarkMock = vi.fn();
    const playback = createMockPlayback({
      setPlaybackSpeed: setPlaybackSpeedMock,
      toggleBookmark: toggleBookmarkMock,
      bookmarked: false,
    });
    render(<PlayMobile playback={playback} />);

    // Open tools drawer
    const toolsBtn = screen.getByRole('button', { name: /playback tools and options/i });
    fireEvent.click(toolsBtn);

    // Modal dialog is present
    expect(screen.getByRole('dialog', { name: /playback tools and settings/i })).toBeDefined();

    // Select 1.5x speed
    const speed15Btn = screen.getByRole('button', { name: '1.5 times speed' });
    fireEvent.click(speed15Btn);
    expect(setPlaybackSpeedMock).toHaveBeenCalledWith(1.5);

    // Toggle bookmark
    const bookmarkRow = screen.getByRole('button', { name: /bookmark this chunk/i });
    fireEvent.click(bookmarkRow);
    expect(toggleBookmarkMock).toHaveBeenCalled();

    // Deferred tools (Capture, Notes, Voice, Report) are rendered disabled with "Coming later"
    const comingLaterBadges = screen.getAllByText('Coming later');
    expect(comingLaterBadges.length).toBe(4);

    // Close tools drawer
    const closeBtn = screen.getByRole('button', { name: /close tools menu/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders reading lessons with ReadingSurface and completion button', () => {
    const completeMock = vi.fn();
    const readingPlayback = createMockPlayback({
      activeItem: {
        chunkId: 'chunk-read-1',
        lessonId: 'lesson-read-1',
        lessonTitle: 'System Design Reading',
        chunkTitle: 'Microkernel Architecture',
        lessonType: 'reading',
        cohortTitle: 'Architecture 101',
        content: {
          text: 'Microkernel architecture structures the system with a minimal core and modular plug-ins.',
          limitations: [],
          contentOrigin: 'human',
        },
      } as any,
      completeActiveChunk: completeMock,
    });

    render(<PlayMobile playback={readingPlayback} />);

    expect(screen.getByRole('article', { name: 'Lesson reading' })).toBeDefined();
    expect(
      screen.getByText(/Microkernel architecture structures the system/i)
    ).toBeDefined();

    const markCompleteBtn = screen.getByRole('button', { name: /mark complete/i });
    fireEvent.click(markCompleteBtn);
    expect(completeMock).toHaveBeenCalled();
  });
});
