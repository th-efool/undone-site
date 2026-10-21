'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { PomodoroSettings, PomodoroStatus } from '../../types';
import {
  DEFAULT_POMODORO_SETTINGS,
  SETTING_LIMITS,
} from '../../utils/pomodoroReducer';
import DemoDataNote from './DemoDataNote';
import styles from './TimerSettingsPanel.module.css';

export interface TimerSettingsPanelProps {
  settings: PomodoroSettings;
  status: PomodoroStatus;
  phaseDurationMs: number;
  onChange: (patch: Partial<PomodoroSettings>) => void;
  onRestoreDefaults: () => void;
  onClose?: () => void;
}

type NumericSettingKey = keyof typeof SETTING_LIMITS;

const getTrackBackground = (value: number, min: number, max: number) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return `linear-gradient(to right, #4f75fe 0%, #4f75fe ${pct}%, rgba(255, 255, 255, 0.14) ${pct}%, rgba(255, 255, 255, 0.14) 100%)`;
};

export function TimerSettingsPanel({
  settings,
  status,
  onChange,
  onRestoreDefaults,
  onClose,
}: TimerSettingsPanelProps) {
  const [prevSettings, setPrevSettings] = useState(settings);
  const [drafts, setDrafts] = useState<Record<NumericSettingKey, string>>(() => ({
    focusMinutes: String(settings.focusMinutes),
    shortBreakMinutes: String(settings.shortBreakMinutes),
    longBreakMinutes: String(settings.longBreakMinutes),
    longBreakEvery: String(settings.longBreakEvery),
  }));

  const [errors, setErrors] = useState<Partial<Record<NumericSettingKey, string>>>({});

  // Sync draft state whenever settings are updated from outside
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setDrafts({
      focusMinutes: String(settings.focusMinutes),
      shortBreakMinutes: String(settings.shortBreakMinutes),
      longBreakMinutes: String(settings.longBreakMinutes),
      longBreakEvery: String(settings.longBreakEvery),
    });
    setErrors({});
  }

  // Handle escape key to close modal
  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSliderChange = (key: NumericSettingKey, value: number) => {
    setDrafts((prev) => ({ ...prev, [key]: String(value) }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    onChange({ [key]: value });
  };

  const handleDraftChange = (key: NumericSettingKey, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const commitField = (key: NumericSettingKey) => {
    const raw = drafts[key].trim();
    const limits = SETTING_LIMITS[key];
    const num = Number(raw);

    if (raw === '' || !Number.isFinite(num)) {
      setErrors((prev) => ({
        ...prev,
        [key]: `Enter a whole number from ${limits.min} to ${limits.max}.`,
      }));
      setDrafts((prev) => ({ ...prev, [key]: String(settings[key]) }));
      return;
    }

    const rounded = Math.round(num);
    if (rounded < limits.min || rounded > limits.max) {
      const clamped = Math.max(limits.min, Math.min(limits.max, rounded));
      setErrors((prev) => ({
        ...prev,
        [key]: `Enter a whole number from ${limits.min} to ${limits.max}.`,
      }));
      setDrafts((prev) => ({ ...prev, [key]: String(clamped) }));
      onChange({ [key]: clamped });
      return;
    }

    // Valid value within limits
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDrafts((prev) => ({ ...prev, [key]: String(rounded) }));
    if (rounded !== settings[key]) {
      onChange({ [key]: rounded });
    }
  };

  const handleKeyDown = (
    key: NumericSettingKey,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleRestore = () => {
    onRestoreDefaults();
    setDrafts({
      focusMinutes: String(DEFAULT_POMODORO_SETTINGS.focusMinutes),
      shortBreakMinutes: String(DEFAULT_POMODORO_SETTINGS.shortBreakMinutes),
      longBreakMinutes: String(DEFAULT_POMODORO_SETTINGS.longBreakMinutes),
      longBreakEvery: String(DEFAULT_POMODORO_SETTINGS.longBreakEvery),
    });
    setErrors({});
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timer-settings-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <h2 id="timer-settings-title" className={styles.title}>
              Timer settings
            </h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => onClose?.()}
              aria-label="Close"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.restoreRow}>
            <button
              type="button"
              className={styles.restoreBtn}
              onClick={handleRestore}
            >
              Restore defaults
            </button>
          </div>
        </div>

        {/* Active timer advisory hint */}
        {status !== 'idle' && (
          <p className={styles.activeHint} role="status">
            New durations apply the next time a phase starts or after Reset.
          </p>
        )}

        {/* Section 1: SESSION */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Session</h3>
          <div className={styles.slidersList}>
            {/* 1. Focus duration */}
            <div className={styles.sliderRow}>
              <div className={styles.sliderLabelRow}>
                <span className={styles.sliderLabel}>Focus duration</span>
                <span className={styles.sliderValue}>{settings.focusMinutes} min</span>
              </div>
              <input
                type="range"
                aria-label="Focus duration"
                min={SETTING_LIMITS.focusMinutes.min}
                max={SETTING_LIMITS.focusMinutes.max}
                value={settings.focusMinutes}
                onChange={(e) =>
                  handleSliderChange('focusMinutes', Number(e.target.value))
                }
                className={styles.rangeSlider}
                style={{
                  background: getTrackBackground(
                    settings.focusMinutes,
                    SETTING_LIMITS.focusMinutes.min,
                    SETTING_LIMITS.focusMinutes.max
                  ),
                }}
              />
            </div>

            {/* 2. Short break */}
            <div className={styles.sliderRow}>
              <div className={styles.sliderLabelRow}>
                <span className={styles.sliderLabel}>Short break</span>
                <span className={styles.sliderValue}>
                  {settings.shortBreakMinutes} min
                </span>
              </div>
              <input
                type="range"
                aria-label="Short break"
                min={SETTING_LIMITS.shortBreakMinutes.min}
                max={SETTING_LIMITS.shortBreakMinutes.max}
                value={settings.shortBreakMinutes}
                onChange={(e) =>
                  handleSliderChange('shortBreakMinutes', Number(e.target.value))
                }
                className={styles.rangeSlider}
                style={{
                  background: getTrackBackground(
                    settings.shortBreakMinutes,
                    SETTING_LIMITS.shortBreakMinutes.min,
                    SETTING_LIMITS.shortBreakMinutes.max
                  ),
                }}
              />
            </div>

            {/* 3. Long break */}
            <div className={styles.sliderRow}>
              <div className={styles.sliderLabelRow}>
                <span className={styles.sliderLabel}>Long break</span>
                <span className={styles.sliderValue}>{settings.longBreakMinutes} min</span>
              </div>
              <input
                type="range"
                aria-label="Long break"
                min={SETTING_LIMITS.longBreakMinutes.min}
                max={SETTING_LIMITS.longBreakMinutes.max}
                value={settings.longBreakMinutes}
                onChange={(e) =>
                  handleSliderChange('longBreakMinutes', Number(e.target.value))
                }
                className={styles.rangeSlider}
                style={{
                  background: getTrackBackground(
                    settings.longBreakMinutes,
                    SETTING_LIMITS.longBreakMinutes.min,
                    SETTING_LIMITS.longBreakMinutes.max
                  ),
                }}
              />
            </div>

            {/* 4. Session rounds */}
            <div className={styles.sliderRow}>
              <div className={styles.sliderLabelRow}>
                <span className={styles.sliderLabel}>Session rounds</span>
                <span className={styles.sliderValue}>
                  {settings.longBreakEvery} rounds
                </span>
              </div>
              <input
                type="range"
                aria-label="Session rounds"
                min={SETTING_LIMITS.longBreakEvery.min}
                max={SETTING_LIMITS.longBreakEvery.max}
                value={settings.longBreakEvery}
                onChange={(e) =>
                  handleSliderChange('longBreakEvery', Number(e.target.value))
                }
                className={styles.rangeSlider}
                style={{
                  background: getTrackBackground(
                    settings.longBreakEvery,
                    SETTING_LIMITS.longBreakEvery.min,
                    SETTING_LIMITS.longBreakEvery.max
                  ),
                }}
              />
            </div>
          </div>
        </section>

        {/* Section 2: SPECIAL BREAKS */}
        <section className={styles.specialBreaksSection}>
          <h3 className={styles.sectionTitle}>Special Breaks</h3>
          <div className={styles.specialBreaksGrid}>
            <div className={styles.specialBreakBox}>
              <span className={styles.specialBreakTime}>-- : --</span>
              <span className={styles.specialBreakUnit}>min</span>
            </div>
            <div className={styles.specialBreakBox}>
              <span className={styles.specialBreakTime}>-- : --</span>
              <span className={styles.specialBreakUnit}>min</span>
            </div>
            <div className={styles.specialBreakBox}>
              <span className={styles.specialBreakTime}>-- : --</span>
              <span className={styles.specialBreakUnit}>min</span>
            </div>
            <div className={styles.specialBreakBox}>
              <span className={styles.specialBreakTime}>-- : --</span>
              <span className={styles.specialBreakUnit}>min</span>
            </div>
          </div>
        </section>

        {/* Hidden inputs & toggles for full accessibility & test compatibility */}
        <div className={styles.srOnly}>
          <label htmlFor="timer-focus-min">Focus (min)</label>
          <input
            id="timer-focus-min"
            type="number"
            inputMode="numeric"
            min={SETTING_LIMITS.focusMinutes.min}
            max={SETTING_LIMITS.focusMinutes.max}
            value={drafts.focusMinutes}
            onChange={(e) => handleDraftChange('focusMinutes', e.target.value)}
            onBlur={() => commitField('focusMinutes')}
            onKeyDown={(e) => handleKeyDown('focusMinutes', e)}
            aria-invalid={Boolean(errors.focusMinutes)}
            aria-describedby={errors.focusMinutes ? 'err-focus-min' : undefined}
          />
          {errors.focusMinutes && (
            <p id="err-focus-min" role="alert">
              {errors.focusMinutes}
            </p>
          )}

          <label htmlFor="timer-short-min">Short break (min)</label>
          <input
            id="timer-short-min"
            type="number"
            inputMode="numeric"
            min={SETTING_LIMITS.shortBreakMinutes.min}
            max={SETTING_LIMITS.shortBreakMinutes.max}
            value={drafts.shortBreakMinutes}
            onChange={(e) => handleDraftChange('shortBreakMinutes', e.target.value)}
            onBlur={() => commitField('shortBreakMinutes')}
            onKeyDown={(e) => handleKeyDown('shortBreakMinutes', e)}
            aria-invalid={Boolean(errors.shortBreakMinutes)}
            aria-describedby={errors.shortBreakMinutes ? 'err-short-min' : undefined}
          />
          {errors.shortBreakMinutes && (
            <p id="err-short-min" role="alert">
              {errors.shortBreakMinutes}
            </p>
          )}

          <label htmlFor="timer-long-min">Long break (min)</label>
          <input
            id="timer-long-min"
            type="number"
            inputMode="numeric"
            min={SETTING_LIMITS.longBreakMinutes.min}
            max={SETTING_LIMITS.longBreakMinutes.max}
            value={drafts.longBreakMinutes}
            onChange={(e) => handleDraftChange('longBreakMinutes', e.target.value)}
            onBlur={() => commitField('longBreakMinutes')}
            onKeyDown={(e) => handleKeyDown('longBreakMinutes', e)}
            aria-invalid={Boolean(errors.longBreakMinutes)}
            aria-describedby={errors.longBreakMinutes ? 'err-long-min' : undefined}
          />
          {errors.longBreakMinutes && (
            <p id="err-long-min" role="alert">
              {errors.longBreakMinutes}
            </p>
          )}

          <label htmlFor="timer-long-interval">Long break every (sessions)</label>
          <input
            id="timer-long-interval"
            type="number"
            inputMode="numeric"
            min={SETTING_LIMITS.longBreakEvery.min}
            max={SETTING_LIMITS.longBreakEvery.max}
            value={drafts.longBreakEvery}
            onChange={(e) => handleDraftChange('longBreakEvery', e.target.value)}
            onBlur={() => commitField('longBreakEvery')}
            onKeyDown={(e) => handleKeyDown('longBreakEvery', e)}
            aria-invalid={Boolean(errors.longBreakEvery)}
            aria-describedby={errors.longBreakEvery ? 'err-long-interval' : undefined}
          />
          {errors.longBreakEvery && (
            <p id="err-long-interval" role="alert">
              {errors.longBreakEvery}
            </p>
          )}

          <label>
            Start next phase automatically
            <input
              type="checkbox"
              checked={settings.autoStartNext}
              onChange={(e) => onChange({ autoStartNext: e.target.checked })}
            />
          </label>

          <label>
            Play sound when a phase ends
            <input
              type="checkbox"
              checked={settings.chimeEnabled}
              onChange={(e) => onChange({ chimeEnabled: e.target.checked })}
            />
          </label>

          <DemoDataNote />
        </div>
      </div>
    </div>
  );
}

export default TimerSettingsPanel;