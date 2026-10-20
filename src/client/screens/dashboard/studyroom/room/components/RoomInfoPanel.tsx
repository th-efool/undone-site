'use client';

import React from 'react';
import Image from 'next/image';
import { CloudRain, Music, Volume2, VolumeX } from 'lucide-react';
import type { RoomDefinition, SharedRoomEnvironment } from '../../types';
import { getBackground } from '../../data/backgroundCatalog';
import { getAmbientPreset } from '../../data/ambientCatalog';
import DemoDataNote from './DemoDataNote';
import styles from './RoomInfoPanel.module.css';

export interface RoomInfoPanelProps {
  room: RoomDefinition;
  environment: SharedRoomEnvironment;
  ambienceStatus: 'idle' | 'playing' | 'blocked' | 'unsupported';
  mutedForMe: boolean;
  onToggleMute: () => void;
  onUnlock: () => void;
}

export function RoomInfoPanel({
  room,
  environment,
  mutedForMe,
  onToggleMute,
}: RoomInfoPanelProps) {
  const currentBg = getBackground(environment.backgroundId);
  const currentPreset = environment.ambience.presetId
    ? getAmbientPreset(environment.ambience.presetId)
    : null;

  const getMusicText = () => {
    if (!environment.music) return 'No music selected';
    const provider = environment.music.provider === 'youtube' ? 'YouTube' : 'Spotify';
    return `${provider} ${environment.music.kind}`;
  };

  const getAmbienceText = () => {
    if (!currentPreset || !environment.ambience.isPlaying) {
      return currentPreset ? `${currentPreset.label} (paused)` : 'No ambient sound selected';
    }
    return `${currentPreset.label} · ${environment.ambience.volume}% volume`;
  };

  return (
    <div className={styles.panel}>
      {/* Read-only notification sentence */}
      <p className={styles.hostSentence}>
        Only the host can change the room.
      </p>

      {/* Overview Cards */}
      <div className={styles.detailsList}>
        {/* Background info */}
        <div className={styles.detailCard}>
          <div
            className={styles.thumbnailWrapper}
            style={{ background: currentBg.gradient }}
          >
            {currentBg.image && (
              <Image
                src={currentBg.image}
                alt=""
                fill
                sizes="56px"
                style={{ objectFit: 'cover' }}
              />
            )}
          </div>
          <div className={styles.detailInfo}>
            <span className={styles.detailTitle}>Background</span>
            <span className={styles.detailValue}>{currentBg.label}</span>
            <span className={styles.attribution}>
              Set by {room.adminDisplayName}
            </span>
          </div>
        </div>

        {/* Music info */}
        <div className={styles.detailCard}>
          <div className={styles.iconWrapper}>
            <Music size={20} aria-hidden="true" />
          </div>
          <div className={styles.detailInfo}>
            <span className={styles.detailTitle}>Music</span>
            <span className={styles.detailValue}>{getMusicText()}</span>
            <span className={styles.attribution}>
              Set by {room.adminDisplayName}
            </span>
          </div>
        </div>

        {/* Ambience info */}
        <div className={styles.detailCard}>
          <div className={styles.iconWrapper}>
            <CloudRain size={20} aria-hidden="true" />
          </div>
          <div className={styles.detailInfo}>
            <span className={styles.detailTitle}>Ambient Sound</span>
            <span className={styles.detailValue}>{getAmbienceText()}</span>
            <span className={styles.attribution}>
              Set by {room.adminDisplayName}
            </span>
          </div>
        </div>
      </div>

      {/* Footer controls: Mute-for-me toggle & prototype note */}
      <div className={styles.footerSection}>
        <div className={styles.muteContainer}>
          <button
            type="button"
            className={`${styles.muteBtn} ${mutedForMe ? styles.muteBtnActive : ''}`}
            aria-pressed={mutedForMe}
            onClick={onToggleMute}
          >
            <span>Mute room sound for me</span>
            {mutedForMe ? (
              <VolumeX size={16} aria-hidden="true" />
            ) : (
              <Volume2 size={16} aria-hidden="true" />
            )}
          </button>
          <p className={styles.muteHelper}>
            Applies to ambient sound only. Use the music player&apos;s own controls for music.
          </p>
        </div>

        <DemoDataNote />
      </div>
    </div>
  );
}

export default RoomInfoPanel;
