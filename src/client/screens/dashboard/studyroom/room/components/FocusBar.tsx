'use client';

import React from 'react';
import { AudioLines, Coffee, Flame, Music2, Pause, Play, RotateCcw, Settings, SkipForward, Sparkles } from 'lucide-react';
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
  onOpenMusic?: (trigger?: HTMLElement) => void;
  onToggleAmbience?: () => void;
  ambienceOpen?: boolean;
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
  onOpenMusic,
  onToggleAmbience,
  ambienceOpen = false,
}: FocusBarProps) {
  const seconds = Math.ceil(state.remainingMs / 1000);
  const timeDisplay = formatClock(seconds);

  const fraction =
    state.phaseDurationMs > 0
      ? Math.max(0, Math.min(1, state.remainingMs / state.phaseDurationMs))
      : 0;
  const strokeDashoffset = 282.74 * (1 - fraction);

  return (
    <aside
      className={styles.focusBar}
      data-phase={state.phase}
      aria-label="Personal Pomodoro Timer"
    >
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
                strokeWidth={7}
              />
              <circle
                className={styles.ringFg}
                cx={50}
                cy={50}
                r={45}
                fill="none"
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={282.74}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
          </div>
          <span className={styles.phaseLabel}>
            {PHASES.find((phase) => phase.id === state.phase)?.label}
          </span>
          <span className={styles.clock} role="timer" aria-live="off">
            {timeDisplay}
          </span>
          <span
            className={styles.streak}
            aria-label={
              state.phase === 'focus'
                ? `${state.completedFocusSessions} completed focus sessions`
                : state.phase === 'shortBreak'
                ? `${state.completedShortBreaks ?? 0} completed short breaks`
                : `${state.completedLongBreaks ?? 0} completed long breaks`
            }
          >
            {state.phase === 'focus' ? (
              <>
                <Flame size={14} className={styles.flameIcon} aria-hidden="true" />{' '}
                {state.completedFocusSessions}
              </>
            ) : state.phase === 'shortBreak' ? (
              <>
                <Coffee size={14} className={styles.coffeeIcon} aria-hidden="true" />{' '}
                {state.completedShortBreaks ?? 0}
              </>
            ) : (
              <>
                <Sparkles size={14} className={styles.sparkleIcon} aria-hidden="true" />{' '}
                {state.completedLongBreaks ?? 0}
              </>
            )}
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
              <Pause size={18} fill="currentColor" aria-hidden="true" />
              <span>Pause</span>
            </button>
          ) : state.status === 'paused' ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onResume}
              aria-label="Resume timer"
            >
              <Play size={18} fill="currentColor" aria-hidden="true" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onStart}
              aria-label="Start timer"
            >
              <Play size={18} fill="currentColor" aria-hidden="true" />
              <span>Start</span>
            </button>
          )}

          <div className={styles.iconRow}>
            {onOpenMusic && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={(e) => onOpenMusic(e.currentTarget)}
                aria-label="Room music"
                title="Room music"
              >
                <Music2 size={16} aria-hidden="true" />
              </button>
            )}

            {onToggleAmbience && (
              <button
                type="button"
                className={`${styles.iconBtn} ${ambienceOpen ? styles.iconBtnActive : ''}`}
                onClick={onToggleAmbience}
                aria-label="Ambience audio"
                title="Sounds & Music"
              >
                <AudioLines size={16} aria-hidden="true" />
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
      </div>

      {/* Row 3: Session count info */}
      <div className={styles.infoRow}>
        <span className={styles.sessionCountText}>
          {state.phase === 'focus' ? (
            <>
              {state.completedFocusSessions} focus{' '}
              {state.completedFocusSessions === 1 ? 'session' : 'sessions'} this visit
            </>
          ) : state.phase === 'shortBreak' ? (
            <>
              {state.completedShortBreaks ?? 0} short{' '}
              {(state.completedShortBreaks ?? 0) === 1 ? 'break' : 'breaks'} this visit
            </>
          ) : (
            <>
              {state.completedLongBreaks ?? 0} long{' '}
              {(state.completedLongBreaks ?? 0) === 1 ? 'break' : 'breaks'} this visit
            </>
          )}
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
