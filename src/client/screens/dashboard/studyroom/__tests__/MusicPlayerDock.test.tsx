/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import MusicPlayerDock from '../room/components/MusicPlayerDock';
import type { MusicSource } from '../types';

const youtubeSource: MusicSource = {
  provider: 'youtube',
  kind: 'video',
  id: 'jfKfPfyJRdk',
  embedUrl: 'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?rel=0&playsinline=1',
  originalUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
};

const spotifySource: MusicSource = {
  provider: 'spotify',
  kind: 'track',
  id: '4cOdK2wGLETKBW3PvgPWqT',
  embedUrl: 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator',
  originalUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
};

describe('MusicPlayerDock component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders YouTube iframe with correct attributes', () => {
    render(
      <MusicPlayerDock
        music={youtubeSource}
        hidden={false}
        onToggleHidden={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Room music (YouTube)') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toBe(youtubeSource.embedUrl);
    expect(iframe.getAttribute('allow')).toBe('autoplay; encrypted-media; picture-in-picture');

    expect(screen.getByText('Trouble playing? Open in YouTube')).toBeTruthy();
  });

  it('renders Spotify iframe with correct attributes', () => {
    render(
      <MusicPlayerDock
        music={spotifySource}
        hidden={false}
        onToggleHidden={vi.fn()}
      />
    );

    const iframe = screen.getByTitle('Room music (Spotify)') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toBe(spotifySource.embedUrl);
    expect(iframe.getAttribute('allow')).toContain('autoplay; clipboard-write; encrypted-media');

    expect(screen.getByText('Trouble playing? Open in Spotify')).toBeTruthy();
  });

  it('unmounts iframe when hidden and remounts when shown', () => {
    const toggleHiddenSpy = vi.fn();

    const { rerender } = render(
      <MusicPlayerDock
        music={youtubeSource}
        hidden={false}
        onToggleHidden={toggleHiddenSpy}
      />
    );

    // Iframe is mounted
    expect(screen.getByTitle('Room music (YouTube)')).toBeTruthy();

    const hideBtn = screen.getByRole('button', { name: 'Hide music player' });
    fireEvent.click(hideBtn);
    expect(toggleHiddenSpy).toHaveBeenCalledTimes(1);

    // Rerender as hidden
    rerender(
      <MusicPlayerDock
        music={youtubeSource}
        hidden={true}
        onToggleHidden={toggleHiddenSpy}
      />
    );

    // Iframe is unmounted
    expect(screen.queryByTitle('Room music (YouTube)')).toBeNull();
    const showBtn = screen.getByRole('button', { name: 'Show music player' });
    expect(showBtn).toBeTruthy();

    fireEvent.click(showBtn);
    expect(toggleHiddenSpy).toHaveBeenCalledTimes(2);
  });
});
