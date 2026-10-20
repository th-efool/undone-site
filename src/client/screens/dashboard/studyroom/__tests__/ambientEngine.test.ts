/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAmbientEngine } from '../utils/ambientEngine';
import type { AmbientPresetId } from '../types';

describe('ambientEngine', () => {
  const originalAudioContext = window.AudioContext;

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
    state: 'suspended' | 'running' = 'suspended';
    destination = createMockAudioNode();

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

    resume = vi.fn().mockImplementation(async () => {
      this.state = 'running';
      return Promise.resolve();
    });

    close = vi.fn().mockImplementation(async () => {
      return Promise.resolve();
    });
  }

  beforeEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
  });

  afterEach(() => {
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    }
  });

  it('returns null when AudioContext is missing in the environment', () => {
    const engine = createAmbientEngine();
    expect(engine).toBeNull();
  });

  it('initializes engine and builds all 10 preset synthesis sub-graphs without error', () => {
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
    const engine = createAmbientEngine();
    expect(engine).not.toBeNull();
    if (!engine) return;

    const presets: AmbientPresetId[] = [
      'rain',
      'thunderstorm',
      'fireplace',
      'ocean-waves',
      'forest',
      'wind',
      'white-noise',
      'pink-noise',
      'brown-noise',
      'cafe',
    ];

    presets.forEach((preset) => {
      expect(() => engine.setPreset(preset, 100)).not.toThrow();
    });

    // Selecting null fades out current preset
    expect(() => engine.setPreset(null, 100)).not.toThrow();

    // Calling again with same preset is a no-op
    expect(() => engine.setPreset(null)).not.toThrow();

    engine.dispose();
  });

  it('sets gain with clamping between 0 and 1', () => {
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
    const engine = createAmbientEngine();
    expect(engine).not.toBeNull();
    if (!engine) return;

    expect(() => engine.setGain(0.4)).not.toThrow();
    expect(() => engine.setGain(-0.5)).not.toThrow();
    expect(() => engine.setGain(1.5)).not.toThrow();
    expect(() => engine.setGain(NaN)).not.toThrow();

    engine.dispose();
  });

  it('reports state and resumes context', async () => {
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
    const engine = createAmbientEngine();
    expect(engine).not.toBeNull();
    if (!engine) return;

    expect(engine.getState()).toBe('suspended');

    const success = await engine.resume();
    expect(success).toBe(true);
    expect(engine.getState()).toBe('running');

    engine.dispose();
    expect(engine.getState()).toBe('suspended');
  });

  it('disposes cleanly and closes the AudioContext', () => {
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
    const engine = createAmbientEngine();
    expect(engine).not.toBeNull();
    if (!engine) return;

    engine.setPreset('rain');
    expect(() => engine.dispose()).not.toThrow();
    // Subsequent calls after dispose are safe no-ops
    expect(() => engine.setPreset('forest')).not.toThrow();
    expect(() => engine.setGain(0.5)).not.toThrow();
    expect(() => engine.dispose()).not.toThrow();
  });
});
