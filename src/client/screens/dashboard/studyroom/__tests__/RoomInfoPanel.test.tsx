/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import RoomInfoPanel from '../room/components/RoomInfoPanel';
import type { RoomDefinition, SharedRoomEnvironment } from '../types';

const mockRoom: RoomDefinition = {
  slug: 'library',
  title: 'Library',
  atmosphere: 'Silent study & focus',
  previewImage: '/images/studyrooms/library.webp',
  adminUserId: 'demo-mira',
  adminDisplayName: 'Mira',
  defaultEnvironment: {
    backgroundId: 'library',
    music: null,
    ambience: {
      presetId: 'rain',
      volume: 40,
      isPlaying: true,
    },
    updatedAt: 0,
    updatedByUserId: 'demo-mira',
  },
};

const mockEnvironment: SharedRoomEnvironment = {
  backgroundId: 'library',
  music: {
    provider: 'youtube',
    kind: 'playlist',
    id: 'PLr4cOdK2wGLE',
    embedUrl: 'https://www.youtube-nocookie.com/embed/videoseries?list=PLr4cOdK2wGLE&rel=0&playsinline=1',
    originalUrl: 'https://www.youtube.com/playlist?list=PLr4cOdK2wGLE',
  },
  ambience: {
    presetId: 'rain',
    volume: 40,
    isPlaying: true,
  },
  updatedAt: 0,
  updatedByUserId: 'demo-mira',
};

describe('RoomInfoPanel component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders read-only environment information and host message', () => {
    render(
      <RoomInfoPanel
        room={mockRoom}
        environment={mockEnvironment}
        ambienceStatus="playing"
        mutedForMe={false}
        onToggleMute={vi.fn()}
        onUnlock={vi.fn()}
      />
    );

    // 1. Mandatory host advisory sentence
    expect(screen.getByText('Only the host can change the room.')).toBeTruthy();

    // 2. Read-only cards info
    expect(screen.getByText('Library')).toBeTruthy();
    expect(screen.getByText('YouTube playlist')).toBeTruthy();
    expect(screen.getByText('Rain · 40% volume')).toBeTruthy();
    expect(screen.getAllByText('Set by Mira')).toHaveLength(3);
  });

  it('strictly enforces absence of interactive inputs, sliders, and radiogroups', () => {
    const { container } = render(
      <RoomInfoPanel
        room={mockRoom}
        environment={mockEnvironment}
        ambienceStatus="playing"
        mutedForMe={false}
        onToggleMute={vi.fn()}
        onUnlock={vi.fn()}
      />
    );

    // No radio buttons
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();

    // No sliders / volume range inputs
    expect(screen.queryByRole('slider')).toBeNull();

    // No text inputs
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('allows member to toggle local mute-for-me', () => {
    const toggleMuteSpy = vi.fn();

    render(
      <RoomInfoPanel
        room={mockRoom}
        environment={mockEnvironment}
        ambienceStatus="playing"
        mutedForMe={false}
        onToggleMute={toggleMuteSpy}
        onUnlock={vi.fn()}
      />
    );

    const muteBtn = screen.getByRole('button', { name: 'Mute room sound for me' });
    expect(muteBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(muteBtn);
    expect(toggleMuteSpy).toHaveBeenCalledTimes(1);
  });
});
