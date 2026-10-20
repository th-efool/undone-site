'use client';

import React from 'react';
import { Pause, Play, RotateCcw, Settings, SkipForward } from 'lucide-react';
import type { PomodoroPhase, PomodoroState } from '../../types';
import { formatClock } from '../../utils/formatTime';
import styles from './FocusBar.module.css';

export interface FocusBarProps {
  state: PomodoroState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
  onSelectPhase: (phase: PomodoroPhase) => void;
  onOpenSettings: (trigger: HTMLElement) => void;
  settingsOpen: boolean;
  announcement: string;
}

const PHASES: readonly { id: PomodoroPhase; label: string }[] = [
  { id: 'focus', label: 'Focus' },
  { id: 'shortBreak', label: 'Short break' },
  { id: 'longBreak', label: 'Long break' },
];

export function FocusBar({
  state,
  onStart,
  onPause,
  onResume,
  onReset,
  onSkip,
  onSelectPhase,
  onOpenSettings,
  settingsOpen,
  announcement,
}: FocusBarProps) {
  const seconds = Math.ceil(state.remainingMs / 1000);
  const timeDisplay = formatClock(seconds);

  const fraction =
    state.phaseDurationMs > 0
      ? Math.max(0, Math.min(1, state.remainingMs / state.phaseDurationMs))
      : 0;
  const strokeDashoffset = 282.74 * (1 - fraction);

  return (
    <aside className={styles.focusBar} aria-label="Personal Pomodoro Timer">
      {/* Row 1: Phase selection toggle buttons */}
      <div className={styles.phaseRow}>
        {PHASES.map(({ id, label }) => {
          const isActive = state.phase === id;
          return (
            <button
              key={id}
              type="button"
              className={`${styles.phaseChip} ${isActive ? styles.phaseChipActive : ''}`}
              aria-pressed={isActive}
              title={`Switch to ${label} (resets the timer)`}
              onClick={() => onSelectPhase(id)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Row 2: Clock countdown, SVG ring progress, and action controls */}
      <div className={styles.clockRow}>
        <div className={styles.timeContainer}>
          <div className={styles.ringWrapper} aria-hidden="true">
            <svg
              className={styles.ringSvg}
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle
                className={styles.ringBg}
                cx={50}
                cy={50}
                r={45}
                fill="none"
                strokeWidth={8}
              />
              <circle
                className={styles.ringFg}
                cx={50}
                cy={50}
                r={45}
                fill="none"
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={282.74}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
          </div>
          <span className={styles.clock} role="timer" aria-live="off">
            {timeDisplay}
          </span>
        </div>

        <div className={styles.controlsGroup}>
          {state.status === 'running' ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onPause}
              aria-label="Pause timer"
            >
              <Pause size={16} aria-hidden="true" />
              <span>Pause</span>
            </button>
          ) : state.status === 'paused' ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onResume}
              aria-label="Resume timer"
            >
              <Play size={16} aria-hidden="true" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onStart}
              aria-label="Start timer"
            >
              <Play size={16} aria-hidden="true" />
              <span>Start</span>
            </button>
          )}

          <button
            type="button"
            className={styles.iconBtn}
            onClick={onReset}
            disabled={state.status === 'idle'}
            aria-label="Reset timer"
            title="Reset timer"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={onSkip}
            aria-label="Skip phase"
            title="Skip to next phase"
          >
            <SkipForward size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${settingsOpen ? styles.iconBtnActive : ''}`}
            onClick={(e) => onOpenSettings(e.currentTarget)}
            aria-label="Timer settings"
            aria-expanded={settingsOpen}
            aria-controls="room-panel"
            aria-haspopup="dialog"
            title="Timer settings"
          >
            <Settings size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Row 3: Cycle completion dots and total sessions text */}
      <div className={styles.infoRow}>
        <div className={styles.cycleDots} aria-hidden="true">
          {Array.from({ length: state.settings.longBreakEvery }).map((_, i) => {
            const isFilled =
              state.phase === 'longBreak' ||
              i < (state.completedFocusSessions % state.settings.longBreakEvery);
            return (
              <span
                key={i}
                className={`${styles.dot} ${isFilled ? styles.dotFilled : ''}`}
              />
            );
          })}
        </div>
        <span className={styles.sessionCountText}>
          {state.completedFocusSessions} focus{' '}
          {state.completedFocusSessions === 1 ? 'session' : 'sessions'} this visit
        </span>
      </div>

      {/* Visually hidden live region for screen readers */}
      <div className={styles.srOnly} aria-live="polite">
        {announcement}
      </div>
    </aside>
  );
}

export default FocusBar;
