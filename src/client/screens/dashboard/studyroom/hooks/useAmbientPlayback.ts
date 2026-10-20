import { useCallback, useEffect, useRef, useState } from 'react';
import type { AmbientPresetId } from '../types';
import { createAmbientEngine, type AmbientEngine } from '../utils/ambientEngine';

export type AmbientPlaybackStatus = 'idle' | 'playing' | 'blocked' | 'unsupported';

export interface UseAmbientPlaybackProps {
  presetId: AmbientPresetId | null;
  volume: number; // integer 0..100
  isPlaying: boolean;
  mutedForMe: boolean;
}

export interface UseAmbientPlaybackReturn {
  status: AmbientPlaybackStatus;
  unlock: () => Promise<boolean>;
}

function isWebAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

export function useAmbientPlayback({
  presetId,
  volume,
  isPlaying,
  mutedForMe,
}: UseAmbientPlaybackProps): UseAmbientPlaybackReturn {
  const engineRef = useRef<AmbientEngine | null>(null);
  const [engineState, setEngineState] = useState<'running' | 'blocked'>('blocked');

  // Compute master engine gain: (volume / 100) ** 2 * 0.6; 0 if muted or not playing
  const targetGain =
    mutedForMe || !isPlaying || presetId === null
      ? 0
      : Math.max(0, Math.min(1, ((volume / 100) ** 2) * 0.6));

  // Determine playback status purely from state & capabilities
  let status: AmbientPlaybackStatus;
  if (!isWebAudioSupported()) {
    status = 'unsupported';
  } else if (!isPlaying || presetId === null) {
    status = 'idle';
  } else {
    status = engineState === 'running' ? 'playing' : 'blocked';
  }

  // Synchronize audio engine with playback parameters
  useEffect(() => {
    if (!isWebAudioSupported()) return;

    if (!isPlaying || presetId === null) {
      if (engineRef.current) {
        engineRef.current.setPreset(null);
        engineRef.current.setGain(0);
      }
      return;
    }

    // Lazily instantiate engine on first play request
    if (!engineRef.current) {
      engineRef.current = createAmbientEngine();
      if (!engineRef.current) return;
    }

    const engine = engineRef.current;
    engine.setPreset(presetId);
    engine.setGain(targetGain);

    // AudioContext state resolution (running vs suspended by browser policy)
    void engine.resume().then((resumed) => {
      setEngineState(resumed ? 'running' : 'blocked');
    });
  }, [presetId, isPlaying, targetGain]);

  // Clean up and release Web Audio resources on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!isWebAudioSupported()) return false;

    if (!engineRef.current) {
      engineRef.current = createAmbientEngine();
    }
    const engine = engineRef.current;
    if (!engine) return false;

    const success = await engine.resume();
    if (success) {
      if (isPlaying && presetId !== null) {
        engine.setPreset(presetId);
        engine.setGain(targetGain);
      }
      setEngineState('running');
      return true;
    }
    return false;
  }, [isPlaying, presetId, targetGain]);

  return {
    status,
    unlock,
  };
}
