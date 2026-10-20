/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSharedEnvironment } from '../hooks/useSharedEnvironment';
import type { SharedRoomEnvironment } from '../types';

const mockInitialEnvironment: SharedRoomEnvironment = {
  backgroundId: 'library',
  music: null,
  ambience: {
    presetId: 'rain',
    volume: 40,
    isPlaying: false,
  },
  updatedAt: 1000,
  updatedByUserId: 'initial-admin',
};

describe('useSharedEnvironment hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(50_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with given environment and stable actions', () => {
    const { result, rerender } = renderHook(
      ({ adminId }) => useSharedEnvironment(mockInitialEnvironment, adminId),
      { initialProps: { adminId: 'host-1' } }
    );

    expect(result.current.environment).toEqual(mockInitialEnvironment);

    const firstActions = result.current.actions;
    rerender({ adminId: 'host-1' });
    expect(result.current.actions).toBe(firstActions);
  });

  it('updates backgroundId and stamps updatedAt and updatedByUserId', () => {
    const { result } = renderHook(() =>
      useSharedEnvironment(mockInitialEnvironment, 'host-1')
    );

    act(() => {
      vi.setSystemTime(60_000);
      result.current.actions.setBackground('cozy-fireplace');
    });

    expect(result.current.environment.backgroundId).toBe('cozy-fireplace');
    expect(result.current.environment.updatedAt).toBe(60_000);
    expect(result.current.environment.updatedByUserId).toBe('host-1');
  });

  it('no-ops when setBackground is called with the current backgroundId', () => {
    const { result } = renderHook(() =>
      useSharedEnvironment(mockInitialEnvironment, 'host-1')
    );

    const prevEnvironment = result.current.environment;

    act(() => {
      vi.setSystemTime(70_000);
      result.current.actions.setBackground('library');
    });

    // Reference unchanged because backgroundId is already 'library'
    expect(result.current.environment).toBe(prevEnvironment);
    expect(result.current.environment.updatedAt).toBe(1000);
  });

  it('updates music source and stamps metadata', () => {
    const { result } = renderHook(() =>
      useSharedEnvironment(mockInitialEnvironment, 'host-1')
    );

    const testMusic = {
      provider: 'youtube' as const,
      kind: 'playlist' as const,
      id: 'PL123456789012',
      embedUrl: 'https://www.youtube-nocookie.com/embed/videoseries?list=PL123456789012&rel=0&playsinline=1',
      originalUrl: 'https://www.youtube.com/playlist?list=PL123456789012',
    };

    act(() => {
      vi.setSystemTime(80_000);
      result.current.actions.setMusic(testMusic);
    });

    expect(result.current.environment.music).toEqual(testMusic);
    expect(result.current.environment.updatedAt).toBe(80_000);
    expect(result.current.environment.updatedByUserId).toBe('host-1');

    // Removing music
    act(() => {
      vi.setSystemTime(90_000);
      result.current.actions.setMusic(null);
    });

    expect(result.current.environment.music).toBeNull();
    expect(result.current.environment.updatedAt).toBe(90_000);
  });

  it('updates ambience preset: non-null enables isPlaying; null disables isPlaying', () => {
    const { result } = renderHook(() =>
      useSharedEnvironment(mockInitialEnvironment, 'host-1')
    );

    act(() => {
      vi.setSystemTime(100_000);
      result.current.actions.setAmbiencePreset('forest');
    });

    expect(result.current.environment.ambience.presetId).toBe('forest');
    expect(result.current.environment.ambience.isPlaying).toBe(true);
    expect(result.current.environment.updatedAt).toBe(100_000);

    act(() => {
      vi.setSystemTime(110_000);
      result.current.actions.setAmbiencePreset(null);
    });

    expect(result.current.environment.ambience.presetId).toBeNull();
    expect(result.current.environment.ambience.isPlaying).toBe(false);
    expect(result.current.environment.updatedAt).toBe(110_000);
  });

  it('setAmbiencePlaying toggles isPlaying when preset is non-null, and no-ops when null', () => {
    const { result } = renderHook(() =>
      useSharedEnvironment(mockInitialEnvironment, 'host-1')
    );

    // Initial has presetId: 'rain'
    act(() => {
      vi.setSystemTime(120_000);
      result.current.actions.setAmbiencePlaying(true);
    });
    expect(result.current.environment.ambience.isPlaying).toBe(true);
    expect(result.current.environment.updatedAt).toBe(120_000);

    // Set preset to null
    act(() => {
      result.current.actions.setAmbiencePreset(null);
    });
    expect(result.current.environment.ambience.presetId).toBeNull();
    expect(result.current.environment.ambience.isPlaying).toBe(false);

    const prevEnv = result.current.environment;

    // Calling setAmbiencePlaying when presetId is null should no-op
    act(() => {
      result.current.actions.setAmbiencePlaying(true);
    });
    expect(result.current.environment).toBe(prevEnv);
    expect(result.current.environment.ambience.isPlaying).toBe(false);
  });

  it('clamps and rounds ambience volume to integer 0..100', () => {
    const { result } = renderHook(() =>
      useSharedEnvironment(mockInitialEnvironment, 'host-1')
    );

    act(() => {
      vi.setSystemTime(130_000);
      result.current.actions.setAmbienceVolume(75.6);
    });
    expect(result.current.environment.ambience.volume).toBe(76);
    expect(result.current.environment.updatedAt).toBe(130_000);

    act(() => {
      result.current.actions.setAmbienceVolume(-15);
    });
    expect(result.current.environment.ambience.volume).toBe(0);

    act(() => {
      result.current.actions.setAmbienceVolume(150);
    });
    expect(result.current.environment.ambience.volume).toBe(100);

    act(() => {
      result.current.actions.setAmbienceVolume(NaN);
    });
    expect(result.current.environment.ambience.volume).toBe(0);
  });
});
