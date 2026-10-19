/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlayDesktop } from '../PlayDesktop';
import type { UsePlaybackResult } from '../hooks/usePlayback';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const createMockPlayback = (overrides?: Partial<UsePlaybackResult>): UsePlaybackResult => {
  return {
    activeItem: {
      chunkId: 'chunk-1',
      lessonId: 'lesson-1',
      lessonTitle: 'The Ultimate AI Foundations Masterclass',
      chunkTitle: 'Introduction to Neural Attention',
      lessonType: 'video',
      lessonVideoId: 'dQw4w9WgXcQ',
      chunkIndex: 1,
      totalChunks: 10,
      cohortProvider: 'YouTube',
      channelId: 'default',
    } as any,
    feedLoading: false,
    feedError: false,
    feedItems: [
      {
        chunkId: 'chunk-1',
        lessonId: 'lesson-1',
        lessonTitle: 'The Ultimate AI Foundations Masterclass',
        chunkTitle: 'Introduction to Neural Attention',
        lessonType: 'video',
        lessonVideoId: 'dQw4w9WgXcQ',
      } as any,
      {
        chunkId: 'chunk-2',
        lessonId: 'lesson-1',
        lessonTitle: 'The Ultimate AI Foundations Masterclass',
        chunkTitle: 'Feed Forward Layers',
        lessonType: 'video',
        lessonVideoId: 'dQw4w9WgXcQ',
      } as any,
    ],
    currentIndex: 0,
    lesson: {
      platform: 'youtube',
      title: 'The Ultimate AI Foundations Masterclass',
      subtitle: '',
      cohortTitle: '',
      cohortId: '',
      seasonOrder: 1,
      seasonNumber: 1,
      currentChunk: 1,
      totalChunks: 10,
      currentVideo: 1,
      totalVideos: 5,
      startTime: '00:00',
      endTime: '04:00',
      currentTime: '01:23',
      totalDuration: '04:00',
      videoId: 'dQw4w9WgXcQ',
    },
    timelineMarkers: [],
    timelineProgress: 35,
    hasNext: true,
    hasPrevious: false,
    isPlaying: true,
    volume: 80,
    muted: false,
    playbackSpeed: 1.0,
    bookmarked: false,
    activeTool: null,
    notesText: '',
    dailyGoalPercent: 50,
    stats: { cohortsCovered: 1, chunksRemaining: 9, estimatedMinutes: 30 },
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
    activeChannel: 'default',
    setActiveChannel: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    fetchChannelFeed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

describe('PlayDesktop visual redesign composition', () => {
  it('renders loading skeleton when feedLoading is true', () => {
    const playback = createMockPlayback({ feedLoading: true });
    render(<PlayDesktop playback={playback} />);

    expect(screen.getByRole('status', { name: /loading lessons/i })).toBeDefined();
  });

  it('renders error notice and retry button when feedError occurs', () => {
    const onRetry = vi.fn();
    const playback = createMockPlayback({
      feedError: true,
      fetchChannelFeed: onRetry,
    });
    render(<PlayDesktop playback={playback} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('heading', { name: /lessons could not be loaded/i })).toBeDefined();

    const reloadBtn = screen.getByRole('button', { name: /reload lessons/i });
    fireEvent.click(reloadBtn);
    expect(onRetry).toHaveBeenCalledWith('default', 0);
  });

  it('renders the header metadata: title, provider, chunk range, and S1:E1 circular progress block', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    // Lesson title
    expect(screen.getByText('The Ultimate AI Foundations Masterclass')).toBeDefined();
    // Provider badge
    expect(screen.getByText('YouTube')).toBeDefined();
    // Chunk info
    expect(screen.getByText('Chunk 1 of 10')).toBeDefined();
    // Chunk relative duration
    expect(screen.getByText('00:00 - 04:00')).toBeDefined();
    // Episode text
    expect(screen.getByText('S1:E1')).toBeDefined();
    expect(screen.getByText('Episode 1 of 5')).toBeDefined();
  });

  it('renders the floating learning tools rail with deferred placeholders and working bookmark', () => {
    const toggleBookmark = vi.fn();
    const playback = createMockPlayback({
      bookmarked: false,
      toggleBookmark,
    });
    render(<PlayDesktop playback={playback} />);

    const toolsRail = screen.getByRole('complementary', { name: /learning tools rail/i });
    expect(toolsRail).toBeDefined();

    // Verify Camera placeholder is disabled with accessible explanation
    const cameraBtn = screen.getByRole('button', { name: /capture screen or visual snapshot/i });
    expect(cameraBtn.getAttribute('aria-disabled')).toBe('true');
    expect(cameraBtn.hasAttribute('disabled')).toBe(true);

    // Verify Annotate placeholder is disabled
    const annotateBtn = screen.getByRole('button', { name: /annotate lesson/i });
    expect(annotateBtn.getAttribute('aria-disabled')).toBe('true');
    expect(annotateBtn.hasAttribute('disabled')).toBe(true);

    // Verify Mic placeholder is disabled
    const micBtn = screen.getByRole('button', { name: /record voice note/i });
    expect(micBtn.getAttribute('aria-disabled')).toBe('true');
    expect(micBtn.hasAttribute('disabled')).toBe(true);

    // Verify Bookmark button is active and functional
    const bookmarkBtn = screen.getByRole('button', { name: /bookmark this chunk/i });
    fireEvent.click(bookmarkBtn);
    expect(toggleBookmark).toHaveBeenCalledTimes(1);
  });

  it('renders detached bottom controls dock with functioning playback controls', () => {
    const completeActiveChunk = vi.fn();
    const nextChunk = vi.fn();
    const toggleMute = vi.fn();

    const playback = createMockPlayback({
      completeActiveChunk,
      nextChunk,
      toggleMute,
      hasNext: true,
    });

    render(<PlayDesktop playback={playback} />);

    const dock = screen.getByRole('toolbar', { name: /playback controls dock/i });
    expect(dock).toBeDefined();

    // Complete chunk button
    const completeBtn = screen.getByRole('button', { name: /mark chunk as complete/i });
    fireEvent.click(completeBtn);
    expect(completeActiveChunk).toHaveBeenCalledTimes(1);

    // Next chunk button
    const nextBtn = screen.getByRole('button', { name: /next chunk/i });
    fireEvent.click(nextBtn);
    expect(nextChunk).toHaveBeenCalledTimes(1);

    // Volume mute button
    const muteBtn = screen.getByRole('button', { name: /mute/i });
    fireEvent.click(muteBtn);
    expect(toggleMute).toHaveBeenCalledTimes(1);

    // Speed selector button
    const speedBtn = screen.getByRole('button', { name: /playback speed: 1x/i });
    fireEvent.click(speedBtn);
    // Menu opens with speed options
    const speed15 = screen.getByRole('menuitem', { name: '1.5x' });
    fireEvent.click(speed15);
    expect(playback.setPlaybackSpeed).toHaveBeenCalledWith(1.5);
  });

  it('renders deferred report button with disabled state and placeholder tooltip', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    const reportBtn = screen.getByRole('button', { name: /report an issue with this chunk/i });
    expect(reportBtn).toBeDefined();
    expect(reportBtn.hasAttribute('disabled')).toBe(true);
    expect(reportBtn.getAttribute('aria-disabled')).toBe('true');
    expect(reportBtn.getAttribute('title')).toBe('Reporting coming later');
  });

  it('opens ShortcutsDialog via ? shortcut and dismisses on Escape', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();

    // Trigger ? shortcut
    fireEvent.keyDown(window, { key: '?' });

    const dialog = screen.getByRole('dialog', { name: /keyboard shortcuts/i });
    expect(dialog).toBeDefined();

    // Dismiss via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();
  });

  it('opens ShortcutsDialog via bottom dock keyboard button', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();

    // Trigger dock keyboard button
    const dockKeyboardBtn = screen.getByRole('button', { name: /keyboard shortcuts/i });
    fireEvent.click(dockKeyboardBtn);

    const dialog = screen.getByRole('dialog', { name: /keyboard shortcuts/i });
    expect(dialog).toBeDefined();

    // Dismiss via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();
  });

  it('disables speed menu for reading items', () => {
    const playback = createMockPlayback({
      activeItem: {
        chunkId: 'chunk-read-1',
        lessonId: 'lesson-1',
        lessonTitle: 'System Design Principles',
        lessonType: 'article',
        content: { text: 'Reading content', contentOrigin: 'ai', limitations: [] },
      } as any,
    });

    render(<PlayDesktop playback={playback} />);

    const speedBtn = screen.getByRole('button', { name: /playback speed unavailable for this lesson/i });
    expect(speedBtn).toBeDefined();
    expect(speedBtn.hasAttribute('disabled')).toBe(true);
    expect(speedBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders honest provider labels for reading and direct video sources without defaulting to YouTube', () => {
    // 1. Reading source
    const readingPlayback = createMockPlayback({
      activeItem: {
        chunkId: 'chunk-read-1',
        lessonId: 'lesson-1',
        lessonTitle: 'System Design Principles',
        lessonType: 'article',
        cohortProvider: 'OpenAI Reading',
        content: { text: 'Reading text', contentOrigin: 'ai', limitations: [] },
      } as any,
    });

    const { unmount } = render(<PlayDesktop playback={readingPlayback} />);
    expect(screen.getByText('OpenAI Reading')).toBeDefined();
    expect(screen.queryByText('YouTube')).toBeNull();
    unmount();

    // 2. Direct video source
    const directVideoPlayback = createMockPlayback({
      activeItem: {
        chunkId: 'chunk-video-1',
        lessonId: 'lesson-2',
        lessonTitle: 'Direct Video Lesson',
        lessonType: 'video',
        lessonVideoUrl: 'https://cdn.example.com/video.mp4',
      } as any,
    });

    render(<PlayDesktop playback={directVideoPlayback} />);
    expect(screen.getByText('Video')).toBeDefined();
    expect(screen.queryByText('YouTube')).toBeNull();
  });

  it('renders completion error toast with retry button when completion fails', () => {
    const completeActiveChunk = vi.fn().mockResolvedValue(undefined);
    const playback = createMockPlayback({
      completionError: 'Network timeout recording progress',
      completeActiveChunk,
    });

    render(<PlayDesktop playback={playback} />);

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeDefined();
    expect(within(alertEl).getByText('Network timeout recording progress')).toBeDefined();

    // 1. Toast retry button
    const toastRetryBtn = within(alertEl).getByRole('button', { name: /retry/i });
    fireEvent.click(toastRetryBtn);
    expect(completeActiveChunk).toHaveBeenCalledTimes(1);

    // 2. Dock retry button
    const dockRetryBtn = screen.getByRole('button', { name: /retry chunk completion/i });
    fireEvent.click(dockRetryBtn);
    expect(completeActiveChunk).toHaveBeenCalledTimes(2);
  });

  it('navigates timeline scrubber with Arrow, Home, and End keys', () => {
    const skipSeconds = vi.fn();
    const seekToPercent = vi.fn();

    const playback = createMockPlayback({
      skipSeconds,
      seekToPercent,
      timelineProgress: 50,
    });

    render(<PlayDesktop playback={playback} />);

    const scrubber = screen.getByRole('slider', { name: /timeline seek scrubber/i });
    expect(scrubber).toBeDefined();

    // Arrow Right seeks +10s
    fireEvent.keyDown(scrubber, { key: 'ArrowRight' });
    expect(skipSeconds).toHaveBeenCalledWith(10);

    // Arrow Left seeks -10s
    fireEvent.keyDown(scrubber, { key: 'ArrowLeft' });
    expect(skipSeconds).toHaveBeenCalledWith(-10);

    // Home seeks to 0%
    fireEvent.keyDown(scrubber, { key: 'Home' });
    expect(seekToPercent).toHaveBeenCalledWith(0);

    // End seeks to 100%
    fireEvent.keyDown(scrubber, { key: 'End' });
    expect(seekToPercent).toHaveBeenCalledWith(100);
  });

  it('toggles ChannelSelector popover with c key and dismisses on Escape', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    expect(screen.queryByRole('region', { name: /channel and search preferences/i })).toBeNull();

    // 1. Press 'c' to open
    fireEvent.keyDown(window, { key: 'c' });
    expect(screen.getByRole('region', { name: /channel and search preferences/i })).toBeDefined();

    // 2. Press 'Escape' to dismiss
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: /channel and search preferences/i })).toBeNull();
  });

  it('renders polite empty state with refresh action when activeItem is null or undefined', () => {
    const fetchChannelFeed = vi.fn().mockResolvedValue(undefined);
    const playback = createMockPlayback({
      activeItem: undefined,
      fetchChannelFeed,
    });

    render(<PlayDesktop playback={playback} />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
    expect(screen.getByText('All Caught Up')).toBeDefined();
    expect(
      screen.getByText("You're caught up with this selection. Choose another channel or return home.")
    ).toBeDefined();

    const refreshBtn = screen.getByRole('button', { name: /refresh channel/i });
    fireEvent.click(refreshBtn);
    expect(fetchChannelFeed).toHaveBeenCalledWith('default', 0);

    const homeLink = screen.getByRole('link', { name: /back home/i });
    expect(homeLink.getAttribute('href')).toBe('/home');
  });
});
