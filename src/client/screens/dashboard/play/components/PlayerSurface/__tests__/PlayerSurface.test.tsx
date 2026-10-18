// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React, { createRef } from 'react';
import { PlayerSurface } from '../PlayerSurface';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

describe('PlayerSurface component', () => {
  afterEach(() => {
    cleanup();
  });

  const baseItem: FeedItem = {
    chunkId: 'chunk-1',
    chunkTitle: 'Test Chunk',
    chunkOrder: 1,
    chunkDuration: '3m',
    startSeconds: 0,
    endSeconds: 180,
    lessonId: 'lesson-1',
    cohortId: 'cohort-1',
    lessonTitle: 'Lesson 1',
    cohortTitle: 'Cohort 1',
    matchScore: 1,
  };

  it('renders default YouTube iframe container when active item is YouTube video without error', () => {
    const containerRef = createRef<HTMLDivElement>();
    const youtubeItem: FeedItem = {
      ...baseItem,
      lessonVideoId: 'dQw4w9WgXcQ',
      lessonType: 'video',
    };

    const { container } = render(
      <PlayerSurface containerRef={containerRef} activeItem={youtubeItem}>
        <div data-testid="overlay">Overlay Content</div>
      </PlayerSurface>,
    );

    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('[class*="videoWrapper"]')).toBeTruthy();
    expect(screen.getByTestId('overlay')).toBeTruthy();
  });

  it('mounts native HTML5 video element when active item has an MP4 source URL', () => {
    const onCompleteChunk = vi.fn();
    const onTimeUpdate = vi.fn();
    const mp4Item: FeedItem = {
      ...baseItem,
      sourceUrl: 'https://cdn.example.com/lessons/lesson1.mp4',
      lessonType: 'video',
    };

    const { container } = render(
      <PlayerSurface
        activeItem={mp4Item}
        onCompleteChunk={onCompleteChunk}
        onTimeUpdate={onTimeUpdate}
      >
        <div data-testid="overlay">Overlay Content</div>
      </PlayerSurface>,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://cdn.example.com/lessons/lesson1.mp4');

    // Simulate video end event
    if (video) {
      fireEvent.ended(video);
      expect(onCompleteChunk).toHaveBeenCalledTimes(1);

      fireEvent.timeUpdate(video);
      expect(onTimeUpdate).toHaveBeenCalled();
    }
  });

  it('mounts native HTML5 video element when lessonVideoId is an HLS m3u8 stream', () => {
    const hlsItem: FeedItem = {
      ...baseItem,
      lessonVideoId: 'https://streaming.example.com/master.m3u8',
      lessonType: 'video',
    };

    const { container } = render(
      <PlayerSurface activeItem={hlsItem}>
        <div data-testid="overlay">Overlay Content</div>
      </PlayerSurface>,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://streaming.example.com/master.m3u8');
  });

  it('renders blocked notice with external link when YouTube API is blocked', () => {
    const youtubeItem: FeedItem = {
      ...baseItem,
      lessonVideoId: 'dQw4w9WgXcQ',
      lessonType: 'video',
    };

    render(
      <PlayerSurface
        activeItem={youtubeItem}
        ytApiError="YouTube player unavailable (blocked by adblocker or network)."
      >
        <div data-testid="overlay">Overlay Content</div>
      </PlayerSurface>,
    );

    expect(screen.getByText('Video Player Blocked')).toBeTruthy();
    expect(
      screen.getByText(/YouTube player unavailable \(blocked by adblocker or network\)\./i),
    ).toBeTruthy();

    const watchLink = screen.getByRole('link', { name: /watch on youtube/i });
    expect(watchLink.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('preserves default container when called without activeItem for backwards compatibility', () => {
    const containerRef = createRef<HTMLDivElement>();

    const { container } = render(
      <PlayerSurface containerRef={containerRef}>
        <div data-testid="children">Child Content</div>
      </PlayerSurface>,
    );

    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByTestId('children')).toBeTruthy();
  });

  it('invokes onVideoMount with HTMLVideoElement when direct video is mounted', () => {
    const onVideoMount = vi.fn();
    const mp4Item: FeedItem = {
      ...baseItem,
      sourceUrl: 'https://cdn.example.com/lessons/lesson1.mp4',
      lessonType: 'video',
    };

    render(
      <PlayerSurface activeItem={mp4Item} onVideoMount={onVideoMount} />
    );

    expect(onVideoMount).toHaveBeenCalledWith(expect.any(HTMLVideoElement));
  });

  it('renders mediaError notice and triggers onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    const mp4Item: FeedItem = {
      ...baseItem,
      sourceUrl: 'https://cdn.example.com/lessons/lesson1.mp4',
      lessonType: 'video',
    };

    render(
      <PlayerSurface
        activeItem={mp4Item}
        mediaError="Playback could not be started."
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Playback Error')).toBeTruthy();
    expect(screen.getByText('Playback could not be started.')).toBeTruthy();

    const retryBtn = screen.getByRole('button', { name: /retry playback/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
