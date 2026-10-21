'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Palette, Pause, Play, Shuffle, SkipBack, SkipForward, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import type { BackgroundId, SharedEnvironmentActions, SharedRoomEnvironment } from '../../types';
import { getBackground, SCENE_BACKGROUNDS, SOLID_BACKGROUNDS } from '../../data/backgroundCatalog';
import { AMBIENT_PRESETS, getAmbientPreset } from '../../data/ambientCatalog';
import type { AmbientPlaybackStatus } from '../../hooks/useAmbientPlayback';
import styles from './SceneDock.module.css';

interface Props {
  environment: SharedRoomEnvironment;
  actions?: SharedEnvironmentActions;
  status: AmbientPlaybackStatus;
  muted: boolean;
  onMute: () => void;
  onUnlock: () => void;
  onCustomize: (trigger: HTMLElement) => void;
  onClose?: () => void;
}

export default function SceneDock({
  environment,
  actions,
  status,
  muted,
  onMute,
  onUnlock,
  onCustomize,
  onClose,
}: Props) {
  const [viewMode, setViewMode] = useState<'scenes' | 'colors'>('scenes');
  const background = getBackground(environment.backgroundId);
  const preset = environment.ambience.presetId ? getAmbientPreset(environment.ambience.presetId) : null;
  const playing = status === 'playing' && !muted;

  const label =
    status === 'unsupported'
      ? 'Audio unavailable in this browser'
      : preset
      ? `${preset.label} · ${
          muted
            ? 'muted for you'
            : status === 'blocked'
            ? 'tap play to listen'
            : environment.ambience.isPlaying
            ? 'playing'
            : 'paused'
        }`
      : 'Choose an ambient sound';

  const changePreset = (direction: number) => {
    const index = AMBIENT_PRESETS.findIndex((opt) => opt.id === environment.ambience.presetId);
    actions?.setAmbiencePreset(
      AMBIENT_PRESETS[(index + direction + AMBIENT_PRESETS.length) % AMBIENT_PRESETS.length].id
    );
  };

  const handleShuffle = () => {
    if (!actions) return;
    const available = AMBIENT_PRESETS.filter((p) => p.id !== environment.ambience.presetId);
    const random = available[Math.floor(Math.random() * available.length)];
    if (random) actions.setAmbiencePreset(random.id);
  };

  const selectBackground = (id: BackgroundId) => {
    actions?.setBackground(id);
  };

  return (
    <div className={styles.dock}>
      {/* 1. Left section: Ambience playback player */}
      <section className={styles.player} aria-label="Room ambience player">
        <div className={styles.cover} style={{ background: background.gradient }}>
          {background.image ? (
            <Image
              src={background.image}
              alt=""
              fill
              sizes="80px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className={styles.solidCoverIcon} style={{ background: background.gradient }}>
              <Palette size={22} />
            </div>
          )}
        </div>

        <div className={styles.track}>
          <strong className={styles.trackTitle}>
            {background.label === 'Cozy fireplace' ? 'Fireplace' : background.label}
          </strong>
          <span className={styles.trackSubtitle}>
            {preset ? label : 'Cozy ambience for deep work'}
          </span>
          <div className={styles.authorBadge}>
            <Sparkles size={11} className={styles.authorIcon} />
            <small>by Undone</small>
          </div>
        </div>

        <div className={styles.playback}>
          {actions && (
            <button
              type="button"
              className={styles.ctrlBtn}
              aria-label="Shuffle ambience"
              title="Shuffle ambient sound"
              onClick={handleShuffle}
            >
              <Shuffle size={16} />
            </button>
          )}

          {actions && (
            <button
              type="button"
              className={styles.ctrlBtn}
              aria-label="Previous ambient sound"
              title="Previous sound"
              onClick={() => changePreset(-1)}
            >
              <SkipBack size={18} />
            </button>
          )}

          <button
            type="button"
            className={styles.playBtn}
            disabled={status === 'unsupported' || !preset}
            aria-label={
              status === 'blocked'
                ? 'Enable room audio'
                : playing
                ? 'Pause room audio'
                : 'Play room audio'
            }
            onClick={() => {
              if (status === 'blocked') {
                onUnlock();
                if (muted) onMute();
              } else if (actions) {
                if (muted) onMute();
                actions.setAmbiencePlaying(!playing);
              } else {
                onMute();
              }
            }}
          >
            {playing ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
            )}
          </button>

          {actions && (
            <button
              type="button"
              className={styles.ctrlBtn}
              aria-label="Next ambient sound"
              title="Next sound"
              onClick={() => changePreset(1)}
            >
              <SkipForward size={18} />
            </button>
          )}
        </div>

        <div className={styles.volume}>
          <button
            type="button"
            className={styles.volBtn}
            onClick={onMute}
            aria-label={muted ? 'Unmute room sound for me' : 'Mute room sound for me'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          {actions && (
            <input
              type="range"
              min={0}
              max={100}
              aria-label="Room volume"
              value={environment.ambience.volume}
              onChange={(e) => actions.setAmbienceVolume(Number(e.target.value))}
              className={styles.volSlider}
            />
          )}
        </div>
      </section>

      {/* 2. Right section: Scenes & Solid Color Theme picker */}
      <section className={styles.scenesSection} aria-label="Room backgrounds">
        <nav className={styles.scenes} aria-label="Room scenes">
          {viewMode === 'scenes' ? (
            <>
              {SCENE_BACKGROUNDS.map((scene) => {
                const isActive = background.id === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    aria-label={`Use ${scene.label} background`}
                    aria-pressed={isActive}
                    onClick={(e) => (actions ? selectBackground(scene.id) : onCustomize(e.currentTarget))}
                    title={actions ? scene.label : 'Only the host can change the room'}
                    className={`${styles.scene} ${isActive ? styles.sceneActive : ''}`}
                  >
                    <span className={styles.thumb}>
                      {scene.image && (
                        <Image
                          src={scene.image}
                          alt=""
                          fill
                          sizes="110px"
                          style={{ objectFit: 'cover' }}
                        />
                      )}
                    </span>
                    <span className={styles.sceneLabel}>
                      {scene.label === 'Cozy fireplace' ? 'Fireplace' : scene.label}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                className={styles.scene}
                onClick={() => setViewMode('colors')}
                aria-label="Switch to solid color themes"
                title="Choose solid color theme"
              >
                <span className={`${styles.thumb} ${styles.colorsThumb}`}>
                  <Palette size={20} />
                </span>
                <span className={styles.sceneLabel}>Colors</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.scene}
                onClick={() => setViewMode('scenes')}
                aria-label="Switch back to scenes"
                title="Back to scenes"
              >
                <span className={`${styles.thumb} ${styles.backThumb}`}>
                  <Sparkles size={18} />
                </span>
                <span className={styles.sceneLabel}>Scenes</span>
              </button>

              {SOLID_BACKGROUNDS.map((solid) => {
                const isActive = background.id === solid.id;
                return (
                  <button
                    key={solid.id}
                    type="button"
                    aria-label={`Use ${solid.label} color`}
                    aria-pressed={isActive}
                    onClick={(e) => (actions ? selectBackground(solid.id) : onCustomize(e.currentTarget))}
                    title={actions ? `${solid.label} solid color` : 'Only the host can change the room'}
                    className={`${styles.scene} ${isActive ? styles.sceneActive : ''}`}
                  >
                    <span
                      className={styles.thumb}
                      style={{ background: solid.gradient }}
                    />
                    <span className={styles.sceneLabel}>{solid.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </nav>
        {onClose && (
          <button
            type="button"
            className={styles.closeDockBtn}
            onClick={onClose}
            aria-label="Close background picker"
            title="Close"
          >
            <X size={16} />
          </button>
        )}
      </section>
    </div>
  );
}
