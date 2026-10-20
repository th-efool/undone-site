'use client';

import React from 'react';
import { Volume2, VolumeX, Play, Pause, Music } from 'lucide-react';
import type {
  SharedEnvironmentActions,
  SharedRoomEnvironment,
} from '../../types';
import { getAmbientPreset } from '../../data/ambientCatalog';
import styles from './RoomSoundChip.module.css';

export interface RoomSoundChipProps {
  environment: SharedRoomEnvironment;
  ambienceStatus: 'idle' | 'playing' | 'blocked' | 'unsupported';
  mutedForMe: boolean;
  onToggleMute: () => void;
  onUnlock: () => void;
  controls?: Pick<SharedEnvironmentActions, 'setAmbiencePlaying'>;
  onOpenRoomPanel: (trigger: HTMLElement) => void;
}

export function RoomSoundChip({
  environment,
  ambienceStatus,
  mutedForMe,
  onToggleMute,
  onUnlock,
  controls,
  onOpenRoomPanel,
}: RoomSoundChipProps) {
  const { ambience, music } = environment;
  const preset = ambience.presetId ? getAmbientPreset(ambience.presetId) : null;

  let soundText = 'No ambient sound';
  if (ambienceStatus === 'unsupported') {
    soundText = "Ambient sound isn't supported";
  } else if (preset) {
    if (mutedForMe) {
      soundText = `${preset.label} · muted for you`;
    } else if (ambience.isPlaying) {
      soundText = `${preset.label} · playing`;
    } else {
      soundText = `${preset.label} · paused`;
    }
  }

  const isBlocked = ambienceStatus === 'blocked';
  const showAdminPlayPause = Boolean(controls && preset);

  return (
    <div className={styles.soundChip}>
      <button
        type="button"
        className={styles.chipTrigger}
        onClick={(e) => onOpenRoomPanel(e.currentTarget)}
        aria-label={`Room sound: ${soundText}. Open room info.`}
      >
        <span className={styles.soundText}>{soundText}</span>
      </button>

      {music && (
        <span className={styles.musicPill} title={`Playing via ${music.provider}`}>
          <Music size={12} aria-hidden="true" />
          <span>{music.provider === 'youtube' ? 'YouTube' : 'Spotify'}</span>
        </span>
      )}

      {isBlocked && (
        <button
          type="button"
          onClick={onUnlock}
          className={styles.unlockBtn}
        >
          Tap to start room sound
        </button>
      )}

      <div className={styles.divider} />

      {showAdminPlayPause && (
        <button
          type="button"
          onClick={() => controls!.setAmbiencePlaying(!ambience.isPlaying)}
          aria-label={ambience.isPlaying ? 'Pause ambient sound' : 'Play ambient sound'}
          aria-pressed={ambience.isPlaying}
          className={styles.iconBtn}
          title={ambience.isPlaying ? 'Pause room sound' : 'Play room sound'}
        >
          {ambience.isPlaying ? (
            <Pause size={14} aria-hidden="true" />
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={mutedForMe ? 'Unmute room sound for me' : 'Mute room sound for me'}
        aria-pressed={mutedForMe}
        className={styles.iconBtn}
        title={mutedForMe ? 'Unmute room sound for me' : 'Mute room sound for me'}
      >
        {mutedForMe ? (
          <VolumeX size={14} aria-hidden="true" />
        ) : (
          <Volume2 size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export default React.memo(RoomSoundChip);
