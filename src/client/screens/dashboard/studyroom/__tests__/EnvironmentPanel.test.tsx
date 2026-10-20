/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import EnvironmentPanel from '../room/components/EnvironmentPanel';
import type {
  SharedEnvironmentActions,
  SharedRoomEnvironment,
} from '../types';

function createMockEnvironment(overrides?: Partial<SharedRoomEnvironment>): SharedRoomEnvironment {
  return {
    backgroundId: 'library',
    music: null,
    ambience: {
      presetId: 'rain',
      volume: 40,
      isPlaying: true,
    },
    updatedAt: Date.now(),
    updatedByUserId: 'demo-admin',
    ...overrides,
  };
}

function createMockActions(): SharedEnvironmentActions {
  return {
    setBackground: vi.fn(),
    setMusic: vi.fn(),
    setAmbiencePreset: vi.fn(),
    setAmbiencePlaying: vi.fn(),
    setAmbienceVolume: vi.fn(),
  };
}

describe('EnvironmentPanel component', () => {
  afterEach(() => {
    cleanup();
  });

  it('navigates tabs using mouse and keyboard arrow keys', () => {
    const actions = createMockActions();
    render(
      <EnvironmentPanel
        environment={createMockEnvironment()}
        actions={actions}
        ambienceStatus="playing"
        mutedForMe={false}
        onToggleMute={vi.fn()}
        onUnlock={vi.fn()}
      />
    );

    const bgTab = screen.getByRole('tab', { name: 'Background' });
    const musicTab = screen.getByRole('tab', { name: 'Music' });
    const ambienceTab = screen.getByRole('tab', { name: 'Ambience' });

    expect(bgTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('radiogroup', { name: 'Room background' })).toBeTruthy();

    // ArrowRight to Music
    fireEvent.keyDown(bgTab, { key: 'ArrowRight' });
    expect(musicTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('YouTube or Spotify link')).toBeTruthy();

    // ArrowRight to Ambience
    fireEvent.keyDown(musicTab, { key: 'ArrowRight' });
    expect(ambienceTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('radiogroup', { name: 'Ambient sound' })).toBeTruthy();

    // ArrowRight wraps to Background
    fireEvent.keyDown(ambienceTab, { key: 'ArrowRight' });
    expect(bgTab.getAttribute('aria-selected')).toBe('true');

    // ArrowLeft wraps to Ambience
    fireEvent.keyDown(bgTab, { key: 'ArrowLeft' });
    expect(ambienceTab.getAttribute('aria-selected')).toBe('true');

    // Home key moves to first tab (Background)
    fireEvent.keyDown(ambienceTab, { key: 'Home' });
    expect(bgTab.getAttribute('aria-selected')).toBe('true');

    // End key moves to last tab (Ambience)
    fireEvent.keyDown(bgTab, { key: 'End' });
    expect(ambienceTab.getAttribute('aria-selected')).toBe('true');
  });

  it('selects background and triggers callbacks', () => {
    const actions = createMockActions();
    const onSelectBg = vi.fn();

    render(
      <EnvironmentPanel
        environment={createMockEnvironment({ backgroundId: 'library' })}
        actions={actions}
        ambienceStatus="playing"
        mutedForMe={false}
        onToggleMute={vi.fn()}
        onUnlock={vi.fn()}
        onBackgroundSelected={onSelectBg}
      />
    );

    const fireplaceRadio = screen.getByRole('radio', { name: /Cozy fireplace/ });
    fireEvent.click(fireplaceRadio);

    expect(actions.setBackground).toHaveBeenCalledWith('cozy-fireplace');
    expect(onSelectBg).toHaveBeenCalledTimes(1);
  });

  it('selects ambience preset, toggles play/pause, and adjusts volume', () => {
    const actions = createMockActions();

    render(
      <EnvironmentPanel
        environment={createMockEnvironment({
          ambience: { presetId: 'rain', volume: 40, isPlaying: true },
        })}
        actions={actions}
        ambienceStatus="playing"
        mutedForMe={false}
        onToggleMute={vi.fn()}
        onUnlock={vi.fn()}
      />
    );

    // Switch to Ambience tab
    const ambienceTab = screen.getByRole('tab', { name: 'Ambience' });
    fireEvent.click(ambienceTab);

    // 1. Select ocean-waves preset
    const wavesOption = screen.getByRole('radio', { name: 'Ocean waves' });
    fireEvent.click(wavesOption);
    expect(actions.setAmbiencePreset).toHaveBeenCalledWith('ocean-waves');

    // 2. Select None
    const noneOption = screen.getByRole('radio', { name: 'None' });
    fireEvent.click(noneOption);
    expect(actions.setAmbiencePreset).toHaveBeenCalledWith(null);

    // 3. Play / Pause toggle
    const pauseBtn = screen.getByRole('button', { name: 'Pause ambient sound' });
    fireEvent.click(pauseBtn);
    expect(actions.setAmbiencePlaying).toHaveBeenCalledWith(false);

    // 4. Volume slider
    const volumeSlider = screen.getByLabelText('Room volume');
    fireEvent.change(volumeSlider, { target: { value: '75' } });
    expect(actions.setAmbienceVolume).toHaveBeenCalledWith(75);
  });

  it('rejects invalid music URL and displays inline error message', () => {
    const actions = createMockActions();

    render(
      <EnvironmentPanel
        environment={createMockEnvironment()}
        actions={actions}
        ambienceStatus="playing"
        mutedForMe={false}
        onToggleMute={vi.fn()}
        onUnlock={vi.fn()}
      />
    );

    // Switch to Music tab
    fireEvent.click(screen.getByRole('tab', { name: 'Music' }));

    const input = screen.getByLabelText('YouTube or Spotify link');
    const submitBtn = screen.getByRole('button', { name: 'Set room music' });

    // Empty submission
    fireEvent.click(submitBtn);
    expect(screen.getByRole('alert').textContent).toBe('Paste a YouTube or Spotify link.');
    expect(actions.setMusic).not.toHaveBeenCalled();

    // Unsupported host
    fireEvent.change(input, { target: { value: 'https://vimeo.com/123456' } });
    fireEvent.click(submitBtn);
    expect(screen.getByRole('alert').textContent).toBe('Only YouTube and Spotify links are supported.');
    expect(actions.setMusic).not.toHaveBeenCalled();
  });

  it('accepts valid YouTube and Spotify links and calls setMusic with embedUrl', () => {
    const actions = createMockActions();
    const notifySpy = vi.fn();

    render(
      <EnvironmentPanel
        environment={createMockEnvironment()}
        actions={actions}
        ambienceStatus="playing"
        mutedForMe={false}
        onToggleMute={vi.fn()}
        onUnlock={vi.fn()}
        onNotify={notifySpy}
      />
    );

    // Switch to Music tab
    fireEvent.click(screen.getByRole('tab', { name: 'Music' }));

    const input = screen.getByLabelText('YouTube or Spotify link');
    const submitBtn = screen.getByRole('button', { name: 'Set room music' });

    // 1. YouTube video
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' } });
    fireEvent.click(submitBtn);

    expect(actions.setMusic).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'youtube',
        kind: 'video',
        id: 'jfKfPfyJRdk',
        embedUrl: 'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?rel=0&playsinline=1',
      })
    );
    expect(notifySpy).toHaveBeenCalledWith('Room music set.');

    // 2. Spotify track
    fireEvent.change(input, {
      target: { value: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' },
    });
    fireEvent.click(submitBtn);

    expect(actions.setMusic).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'spotify',
        kind: 'track',
        id: '4cOdK2wGLETKBW3PvgPWqT',
        embedUrl: 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator',
      })
    );
  });
});
