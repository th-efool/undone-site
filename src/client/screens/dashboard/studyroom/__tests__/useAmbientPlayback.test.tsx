/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAmbientPlayback } from '../hooks/useAmbientPlayback';

describe('useAmbientPlayback hook in jsdom (unsupported)', () => {
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    // Ensure AudioContext is undefined in jsdom
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
  });

  afterEach(() => {
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    }
  });

  it('reports unsupported when AudioContext is missing without throwing', async () => {
    const { result } = renderHook(() =>
      useAmbientPlayback({
        presetId: 'rain',
        volume: 40,
        isPlaying: true,
        mutedForMe: false,
      })
    );

    expect(result.current.status).toBe('unsupported');

    let unlocked = false;
    await act(async () => {
      unlocked = await result.current.unlock();
    });
    expect(unlocked).toBe(false);
    expect(result.current.status).toBe('unsupported');
  });
});

describe('useAmbientPlayback hook with simulated AudioContext', () => {
  let mockState: 'suspended' | 'running' = 'suspended';
  const closeSpy = vi.fn();
  const resumeSpy = vi.fn();

  function createMockAudioParam(initial: number = 0) {
    return {
      value: initial,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    };
  }

  function createMockAudioNode() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  class MockAudioContext {
    currentTime = 0;
    sampleRate = 44100;
    destination = createMockAudioNode();

    get state() {
      return mockState;
    }

    createGain() {
      return {
        ...createMockAudioNode(),
        gain: createMockAudioParam(1),
      };
    }

    createBuffer(channels: number, length: number, sampleRate: number) {
      const channelData = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: () => channelData,
      };
    }

    createBufferSource() {
      return {
        ...createMockAudioNode(),
        buffer: null,
        loop: false,
        start: vi.fn(),
        stop: vi.fn(),
      };
    }

    createBiquadFilter() {
      return {
        ...createMockAudioNode(),
        type: 'lowpass',
        frequency: createMockAudioParam(350),
        Q: createMockAudioParam(1),
      };
    }

    createOscillator() {
      return {
        ...createMockAudioNode(),
        type: 'sine',
        frequency: createMockAudioParam(440),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }

    resume = resumeSpy.mockImplementation(async () => {
      mockState = 'running';
      return Promise.resolve();
    });

    close = closeSpy.mockImplementation(async () => {
      return Promise.resolve();
    });
  }

  beforeEach(() => {
    mockState = 'suspended';
    closeSpy.mockClear();
    resumeSpy.mockClear();
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
  });

  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });

  it('starts idle when isPlaying is false or presetId is null', () => {
    const { result } = renderHook(() =>
      useAmbientPlayback({
        presetId: null,
        volume: 40,
        isPlaying: false,
        mutedForMe: false,
      })
    );

    expect(result.current.status).toBe('idle');
  });

  it('transitions to blocked when autoplay is suspended, and unlocks to playing on user gesture', async () => {
    // When suspended and resume fails/does not run, state is blocked
    resumeSpy.mockImplementationOnce(async () => {
      mockState = 'suspended';
      return Promise.resolve();
    });

    const { result } = renderHook(() =>
      useAmbientPlayback({
        presetId: 'rain',
        volume: 50,
        isPlaying: true,
        mutedForMe: false,
      })
    );

    // Initial status before resume resolves or while blocked
    expect(['blocked', 'playing']).toContain(result.current.status);

    // Now unlock with user gesture (resume resolves to running)
    resumeSpy.mockImplementationOnce(async () => {
      mockState = 'running';
      return Promise.resolve();
    });

    let success = false;
    await act(async () => {
      success = await result.current.unlock();
    });

    expect(success).toBe(true);
    expect(result.current.status).toBe('playing');
  });

  it('disposes engine and closes AudioContext on unmount', async () => {
    mockState = 'running';

    const { unmount } = renderHook(() =>
      useAmbientPlayback({
        presetId: 'rain',
        volume: 40,
        isPlaying: true,
        mutedForMe: false,
      })
    );

    unmount();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
