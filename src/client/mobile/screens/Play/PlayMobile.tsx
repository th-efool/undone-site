'use client';

import { Play as PlayIcon, Pause, SkipBack, SkipForward } from 'lucide-react';
import type { UsePlaybackResult } from '@/src/client/screens/dashboard/play/hooks/usePlayback';
import styles from './PlayMobile.module.css';

interface PlayMobileProps {
  playback: UsePlaybackResult;
}

export function PlayMobile({ playback }: PlayMobileProps) {
  return (
    <main className={styles.mobilePlay}>
      <div className={styles.playerArea}>
        <div className={styles.controlsOverlay}>
          <header className={styles.header}>
            <span className={styles.lessonTitle}>{playback.lesson.title || 'Lesson Playback'}</span>
          </header>

          <div className={styles.centerControls}>
            <button className={styles.skipBtn} onClick={() => playback.skipSeconds(-10)} aria-label="Rewind 10s">
              <SkipBack size={20} />
            </button>
            <button className={styles.playBtn} onClick={playback.togglePlayback} aria-label={playback.isPlaying ? 'Pause' : 'Play'}>
              {playback.isPlaying ? <Pause size={28} /> : <PlayIcon size={28} fill="currentColor" />}
            </button>
            <button className={styles.skipBtn} onClick={() => playback.skipSeconds(10)} aria-label="Forward 10s">
              <SkipForward size={20} />
            </button>
          </div>

          <div className={styles.bottomBar}>
            <div className={styles.timeInfo}>
              <span>{playback.lesson.currentTime}</span>
              <span>{playback.lesson.totalDuration}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
