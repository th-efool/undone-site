/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlayDock } from '../PlayDock';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultProps = {
  volume: 85,
  muted: false,
  playbackSpeed: 1.0,
  hasNext: true,
  completionPending: false,
  completionError: null,
  isCompleted: false,
  speedSupported: true,
  isFullscreen: false,
  onVolumeChange: vi.fn(),
  onToggleMute: vi.fn(),
  onSpeedChange: vi.fn(),
  onCompleteChunk: vi.fn(),
  onNextChunk: vi.fn(),
  onToggleFullscreen: vi.fn(),
};

describe('PlayDock component', () => {
  it('triggers onToggleFullscreen when fullscreen button is clicked', () => {
    const onToggleFullscreen = vi.fn();
    render(<PlayDock {...defaultProps} onToggleFullscreen={onToggleFullscreen} />);

    const fsBtn = screen.getByRole('button', { name: /enter fullscreen/i });
    fireEvent.click(fsBtn);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleMute and onVolumeChange from volume capsule', () => {
    const onToggleMute = vi.fn();
    const onVolumeChange = vi.fn();
    render(
      <PlayDock
        {...defaultProps}
        onToggleMute={onToggleMute}
        onVolumeChange={onVolumeChange}
      />
    );

    const muteBtn = screen.getByRole('button', { name: /^mute$/i });
    fireEvent.click(muteBtn);
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    const slider = screen.getByRole('slider', { name: /volume level/i });
    fireEvent.change(slider, { target: { value: '45' } });
    expect(onVolumeChange).toHaveBeenCalledWith(45);
  });

  it('handles chunk completion states: normal, pending, error retry', () => {
    const onCompleteChunk = vi.fn();
    const { rerender } = render(
      <PlayDock {...defaultProps} onCompleteChunk={onCompleteChunk} />
    );

    const completeBtn = screen.getByRole('button', { name: /mark chunk as complete/i });
    fireEvent.click(completeBtn);
    expect(onCompleteChunk).toHaveBeenCalledTimes(1);

    // Pending state disables button
    rerender(<PlayDock {...defaultProps} completionPending={true} />);
    const pendingBtn = screen.getByRole('button', { name: /mark chunk as complete/i });
    expect(pendingBtn.hasAttribute('disabled')).toBe(true);

    // Error retry state
    rerender(
      <PlayDock
        {...defaultProps}
        completionError="Failed to save"
        onCompleteChunk={onCompleteChunk}
      />
    );
    const retryBtn = screen.getByRole('button', { name: /retry chunk completion/i });
    fireEvent.click(retryBtn);
    expect(onCompleteChunk).toHaveBeenCalledTimes(2);
  });

  it('disables next chunk button when hasNext is false', () => {
    const onNextChunk = vi.fn();
    render(<PlayDock {...defaultProps} hasNext={false} onNextChunk={onNextChunk} />);

    const nextBtn = screen.getByRole('button', { name: /next chunk/i });
    expect(nextBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(nextBtn);
    expect(onNextChunk).not.toHaveBeenCalled();
  });

  it('toggles speed menu, changes speed, and dismisses on Escape key', () => {
    const onSpeedChange = vi.fn();
    render(<PlayDock {...defaultProps} onSpeedChange={onSpeedChange} />);

    const speedBtn = screen.getByRole('button', { name: /playback speed: 1x/i });
    fireEvent.click(speedBtn);

    const menu = screen.getByRole('menu', { name: /playback speed options/i });
    expect(menu).toBeDefined();

    // Select 1.5x option
    const speed15 = screen.getByRole('menuitem', { name: '1.5x' });
    fireEvent.click(speed15);
    expect(onSpeedChange).toHaveBeenCalledWith(1.5);
    expect(screen.queryByRole('menu')).toBeNull();

    // Reopen and test Escape key dismissal
    fireEvent.click(speedBtn);
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders closed captions and flag report as disabled placeholders with clear tooltips', () => {
    render(<PlayDock {...defaultProps} />);

    const captionsBtn = screen.getByRole('button', { name: /captions and subtitles coming later/i });
    expect(captionsBtn.hasAttribute('disabled')).toBe(true);
    expect(captionsBtn.getAttribute('aria-disabled')).toBe('true');
    expect(captionsBtn.getAttribute('title')).toBe('Captions coming later');

    const flagBtn = screen.getByRole('button', { name: /report an issue with this chunk/i });
    expect(flagBtn.hasAttribute('disabled')).toBe(true);
    expect(flagBtn.getAttribute('aria-disabled')).toBe('true');
    expect(flagBtn.getAttribute('title')).toBe('Reporting coming later');
  });
});
