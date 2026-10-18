'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  CheckCircle,
  SkipForward,
  Timer,
  ChevronDown,
  Subtitles,
  Flag,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './PlayDock.module.css';

interface PlayDockProps {
  volume: number;
  muted: boolean;
  playbackSpeed: number;
  hasNext: boolean;
  completionPending: boolean;
  isFullscreen: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onSpeedChange: (speed: number) => void;
  onCompleteChunk: () => void;
  onNextChunk: () => void;
  onToggleFullscreen: () => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export function PlayDock({
  volume,
  muted,
  playbackSpeed,
  hasNext,
  completionPending,
  isFullscreen,
  onVolumeChange,
  onToggleMute,
  onSpeedChange,
  onCompleteChunk,
  onNextChunk,
  onToggleFullscreen,
}: PlayDockProps) {
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [captionsActive, setCaptionsActive] = useState(false);
  const speedRef = useRef<HTMLDivElement>(null);

  // Close speed menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false);
      }
    }
    if (speedMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [speedMenuOpen]);

  const effectiveVol = muted ? 0 : volume;

  const handleComplete = () => {
    if (completionPending) return;
    triggerHaptic('success');
    onCompleteChunk();
  };

  const handleNext = () => {
    if (!hasNext) return;
    triggerHaptic('light');
    onNextChunk();
  };

  return (
    <>
      <div className={styles.dockContainer} role="toolbar" aria-label="Playback controls dock">
        {/* Capsule 1: Fullscreen */}
        <div className={styles.capsule}>
          <button
            type="button"
            className={styles.dockButton}
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        {/* Capsule 2: Volume & Audio Slider */}
        <div className={`${styles.capsule} ${styles.volumeCapsule}`}>
          <button
            type="button"
            className={styles.dockButton}
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted || effectiveVol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            className={styles.volumeSlider}
            min={0}
            max={100}
            value={effectiveVol}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            style={{
              background: `linear-gradient(to right, #5430FF ${effectiveVol}%, rgba(255, 255, 255, 0.2) ${effectiveVol}%)`,
            }}
            aria-label="Volume level"
          />
        </div>

        {/* Capsule 3: Mark Chunk Complete */}
        <div className={styles.capsule}>
          <button
            type="button"
            className={styles.dockButton}
            onClick={handleComplete}
            disabled={completionPending}
            aria-label="Mark chunk as complete"
            title="Complete chunk"
          >
            {completionPending ? (
              <Loader2 size={18} className={styles.spinner} />
            ) : (
              <CheckCircle size={18} />
            )}
          </button>
        </div>

        {/* Capsule 4: Skip Forward / Next Chunk */}
        <div className={styles.capsule}>
          <button
            type="button"
            className={styles.dockButton}
            onClick={handleNext}
            disabled={!hasNext}
            aria-label="Next chunk"
            title="Next chunk"
          >
            <SkipForward size={18} />
          </button>
        </div>

        {/* Capsule 5: Playback Speed */}
        <div className={styles.speedWrapper} ref={speedRef}>
          <div className={styles.capsule}>
            <button
              type="button"
              className={styles.dockButton}
              onClick={() => setSpeedMenuOpen((prev) => !prev)}
              aria-label={`Playback speed: ${playbackSpeed}x`}
              aria-haspopup="menu"
              aria-expanded={speedMenuOpen}
              title="Change playback speed"
            >
              <Timer size={16} />
              <span>{playbackSpeed}x</span>
              <ChevronDown size={14} />
            </button>
          </div>

          {speedMenuOpen && (
            <div className={styles.speedMenu} role="menu" aria-label="Playback speed options">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`${styles.speedOption} ${speed === playbackSpeed ? styles.speedOptionActive : ''}`}
                  role="menuitem"
                  onClick={() => {
                    onSpeedChange(speed);
                    setSpeedMenuOpen(false);
                  }}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Capsule 6: Captions / CC */}
        <div className={styles.capsule}>
          <button
            type="button"
            className={styles.dockButton}
            onClick={() => setCaptionsActive((p) => !p)}
            aria-label={captionsActive ? 'Disable captions' : 'Enable captions'}
            title="Captions / Subtitles"
            style={{ color: captionsActive ? '#5430FF' : 'inherit' }}
          >
            <Subtitles size={18} />
          </button>
        </div>

        {/* Capsule 7: Report Issue */}
        <div className={styles.capsule}>
          <button
            type="button"
            className={styles.dockButton}
            onClick={() => setReportModalOpen(true)}
            aria-label="Report an issue with this chunk"
            title="Report issue"
          >
            <Flag size={18} />
          </button>
        </div>
      </div>

      {/* Report Modal Notice (Deferred per scope boundary) */}
      {reportModalOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <div className={styles.modalContent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={24} color="#F59E0B" />
              <h2 id="report-modal-title" className={styles.modalTitle}>Report Content</h2>
            </div>
            <p className={styles.modalDesc}>
              Report submission is currently deferred in this release. If a video fails to play or load, use the retry button or choose another lesson in the channel selector.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setReportModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
