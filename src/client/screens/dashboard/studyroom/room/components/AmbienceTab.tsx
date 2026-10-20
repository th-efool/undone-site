'use client';

import React from 'react';
import {
  AudioLines,
  Check,
  CloudLightning,
  CloudRain,
  Coffee,
  Flame,
  Pause,
  Play,
  Trees,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from 'lucide-react';
import type { AmbientPresetId, SharedAmbience, SharedEnvironmentActions } from '../../types';
import { AMBIENT_PRESETS } from '../../data/ambientCatalog';
import styles from './AmbienceTab.module.css';

export interface AmbienceTabProps {
  ambience: SharedAmbience;
  status: 'idle' | 'playing' | 'blocked' | 'unsupported';
  actions: Pick<
    SharedEnvironmentActions,
    'setAmbiencePreset' | 'setAmbiencePlaying' | 'setAmbienceVolume'
  >;
}

function getPresetIcon(icon: string) {
  switch (icon) {
    case 'CloudRain':
      return <CloudRain size={16} aria-hidden="true" />;
    case 'CloudLightning':
      return <CloudLightning size={16} aria-hidden="true" />;
    case 'Flame':
      return <Flame size={16} aria-hidden="true" />;
    case 'Waves':
      return <Waves size={16} aria-hidden="true" />;
    case 'Trees':
      return <Trees size={16} aria-hidden="true" />;
    case 'Wind':
      return <Wind size={16} aria-hidden="true" />;
    case 'AudioLines':
      return <AudioLines size={16} aria-hidden="true" />;
    case 'Coffee':
      return <Coffee size={16} aria-hidden="true" />;
    default:
      return <Volume2 size={16} aria-hidden="true" />;
  }
}

export function AmbienceTab({ ambience, status, actions }: AmbienceTabProps) {
  const isUnsupported = status === 'unsupported';
  const hasPreset = ambience.presetId !== null;
  const isControlsDisabled = !hasPreset || isUnsupported;

  return (
    <div className={styles.container}>
      {isUnsupported && (
        <p className={styles.unsupportedWarning} role="alert">
          Ambient sound isn&apos;t supported in this browser.
        </p>
      )}

      {/* Preset selection grid */}
      <div
        role="radiogroup"
        aria-label="Ambient sound"
        className={styles.grid}
      >
        {/* Option 1: None */}
        <button
          type="button"
          role="radio"
          aria-checked={ambience.presetId === null}
          className={`${styles.presetBtn} ${
            ambience.presetId === null ? styles.presetBtnSelected : ''
          }`}
          onClick={() => actions.setAmbiencePreset(null)}
        >
          <div className={styles.iconWrapper}>
            <VolumeX size={16} aria-hidden="true" />
          </div>
          <span className={styles.presetLabel}>None</span>
          {ambience.presetId === null && (
            <Check size={14} className={styles.checkIcon} aria-hidden="true" />
          )}
        </button>

        {/* Options 2..11: Preset list */}
        {AMBIENT_PRESETS.map((preset) => {
          const isSelected = ambience.presetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`${styles.presetBtn} ${
                isSelected ? styles.presetBtnSelected : ''
              }`}
              onClick={() => actions.setAmbiencePreset(preset.id as AmbientPresetId)}
            >
              <div className={styles.iconWrapper}>
                {getPresetIcon(preset.icon)}
              </div>
              <span className={styles.presetLabel}>{preset.label}</span>
              {isSelected && (
                <Check
                  size={14}
                  className={styles.checkIcon}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Controls: Play/Pause and Volume */}
      <div className={styles.controlsSection}>
        <button
          type="button"
          className={styles.playPauseBtn}
          disabled={isControlsDisabled}
          aria-pressed={ambience.isPlaying}
          onClick={() => actions.setAmbiencePlaying(!ambience.isPlaying)}
        >
          {ambience.isPlaying ? (
            <>
              <Pause size={16} aria-hidden="true" />
              <span>Pause ambient sound</span>
            </>
          ) : (
            <>
              <Play size={16} aria-hidden="true" />
              <span>Play ambient sound</span>
            </>
          )}
        </button>

        <div className={styles.volumeField}>
          <div className={styles.volumeHeader}>
            <label htmlFor="room-ambience-volume">Room volume</label>
            <span>{ambience.volume}%</span>
          </div>
          <input
            id="room-ambience-volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={ambience.volume}
            disabled={isControlsDisabled}
            aria-valuetext={`${ambience.volume} percent`}
            className={styles.volumeSlider}
            onChange={(e) => actions.setAmbienceVolume(Number(e.target.value))}
          />
        </div>

        {!hasPreset && (
          <p className={styles.helperText}>No ambient sound selected.</p>
        )}
      </div>
    </div>
  );
}

export default AmbienceTab;
