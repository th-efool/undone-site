/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SceneDock from '../room/components/SceneDock';
import type { SharedRoomEnvironment } from '../types';

describe('SceneDock component', () => {
  afterEach(() => {
    cleanup();
  });
  const mockEnvironment: SharedRoomEnvironment = {
    backgroundId: 'cozy-fireplace',
    music: null,
    ambience: {
      presetId: 'fireplace',
      volume: 40,
      isPlaying: true,
    },
    updatedAt: Date.now(),
    updatedByUserId: 'test-user',
  };

  const mockActions = {
    setBackground: vi.fn(),
    setMusic: vi.fn(),
    setAmbiencePreset: vi.fn(),
    setAmbienceVolume: vi.fn(),
    setAmbiencePlaying: vi.fn(),
  };

  it('renders track info, playing status label, and scene options', () => {
    render(
      <SceneDock
        environment={mockEnvironment}
        actions={mockActions}
        status="playing"
        muted={false}
        onMute={vi.fn()}
        onUnlock={vi.fn()}
        onCustomize={vi.fn()}
      />
    );

    expect(screen.getAllByText('Fireplace').length).toBeGreaterThan(0);
    expect(screen.getByText('Fireplace · playing')).toBeTruthy();
    expect(screen.getByText('by Undone')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Use Cozy fireplace background/i })).toBeTruthy();
  });

  it('allows switching to solid color themes and selecting a solid color', () => {
    render(
      <SceneDock
        environment={mockEnvironment}
        actions={mockActions}
        status="playing"
        muted={false}
        onMute={vi.fn()}
        onUnlock={vi.fn()}
        onCustomize={vi.fn()}
      />
    );

    const colorsBtn = screen.getByRole('button', { name: /Switch to solid color themes/i });
    fireEvent.click(colorsBtn);

    const midnightBtn = screen.getByRole('button', { name: /Use Midnight color/i });
    expect(midnightBtn).toBeTruthy();

    fireEvent.click(midnightBtn);
    expect(mockActions.setBackground).toHaveBeenCalledWith('solid-midnight');
  });

  it('handles play/pause toggle click', () => {
    render(
      <SceneDock
        environment={mockEnvironment}
        actions={mockActions}
        status="playing"
        muted={false}
        onMute={vi.fn()}
        onUnlock={vi.fn()}
        onCustomize={vi.fn()}
      />
    );

    const playPauseBtn = screen.getByRole('button', { name: /Pause room audio/i });
    fireEvent.click(playPauseBtn);
    expect(mockActions.setAmbiencePlaying).toHaveBeenCalledWith(false);
  });
});
