'use client';

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
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
}

type NumericSettingKey = keyof typeof SETTING_LIMITS;

export function TimerSettingsPanel({
  settings,
  status,
  onChange,
  onRestoreDefaults,
}: TimerSettingsPanelProps) {
  const [prevSettings, setPrevSettings] = useState(settings);
  const [drafts, setDrafts] = useState<Record<NumericSettingKey, string>>(() => ({
    focusMinutes: String(settings.focusMinutes),
    shortBreakMinutes: String(settings.shortBreakMinutes),
    longBreakMinutes: String(settings.longBreakMinutes),
    longBreakEvery: String(settings.longBreakEvery),
  }));

  const [errors, setErrors] = useState<Partial<Record<NumericSettingKey, string>>>({});

  // Sync draft state whenever settings are updated from outside (official React pattern)
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
    <div className={styles.panel}>
      {/* Active timer advisory hint */}
      {status !== 'idle' && (
        <p className={styles.activeHint} role="status">
          New durations apply the next time a phase starts or after Reset.
        </p>
      )}

      {/* Durations grid */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Durations</h3>
        <div className={styles.fieldsGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="timer-focus-min">
              Focus (min)
            </label>
            <input
              id="timer-focus-min"
              type="number"
              inputMode="numeric"
              min={SETTING_LIMITS.focusMinutes.min}
              max={SETTING_LIMITS.focusMinutes.max}
              className={`${styles.input} ${errors.focusMinutes ? styles.inputError : ''}`}
              value={drafts.focusMinutes}
              onChange={(e) => handleDraftChange('focusMinutes', e.target.value)}
              onBlur={() => commitField('focusMinutes')}
              onKeyDown={(e) => handleKeyDown('focusMinutes', e)}
              aria-invalid={Boolean(errors.focusMinutes)}
              aria-describedby={errors.focusMinutes ? 'err-focus-min' : undefined}
            />
            {errors.focusMinutes && (
              <p id="err-focus-min" className={styles.errorText} role="alert">
                {errors.focusMinutes}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="timer-short-min">
              Short break (min)
            </label>
            <input
              id="timer-short-min"
              type="number"
              inputMode="numeric"
              min={SETTING_LIMITS.shortBreakMinutes.min}
              max={SETTING_LIMITS.shortBreakMinutes.max}
              className={`${styles.input} ${errors.shortBreakMinutes ? styles.inputError : ''}`}
              value={drafts.shortBreakMinutes}
              onChange={(e) => handleDraftChange('shortBreakMinutes', e.target.value)}
              onBlur={() => commitField('shortBreakMinutes')}
              onKeyDown={(e) => handleKeyDown('shortBreakMinutes', e)}
              aria-invalid={Boolean(errors.shortBreakMinutes)}
              aria-describedby={errors.shortBreakMinutes ? 'err-short-min' : undefined}
            />
            {errors.shortBreakMinutes && (
              <p id="err-short-min" className={styles.errorText} role="alert">
                {errors.shortBreakMinutes}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="timer-long-min">
              Long break (min)
            </label>
            <input
              id="timer-long-min"
              type="number"
              inputMode="numeric"
              min={SETTING_LIMITS.longBreakMinutes.min}
              max={SETTING_LIMITS.longBreakMinutes.max}
              className={`${styles.input} ${errors.longBreakMinutes ? styles.inputError : ''}`}
              value={drafts.longBreakMinutes}
              onChange={(e) => handleDraftChange('longBreakMinutes', e.target.value)}
              onBlur={() => commitField('longBreakMinutes')}
              onKeyDown={(e) => handleKeyDown('longBreakMinutes', e)}
              aria-invalid={Boolean(errors.longBreakMinutes)}
              aria-describedby={errors.longBreakMinutes ? 'err-long-min' : undefined}
            />
            {errors.longBreakMinutes && (
              <p id="err-long-min" className={styles.errorText} role="alert">
                {errors.longBreakMinutes}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="timer-long-interval">
              Long break every (sessions)
            </label>
            <input
              id="timer-long-interval"
              type="number"
              inputMode="numeric"
              min={SETTING_LIMITS.longBreakEvery.min}
              max={SETTING_LIMITS.longBreakEvery.max}
              className={`${styles.input} ${errors.longBreakEvery ? styles.inputError : ''}`}
              value={drafts.longBreakEvery}
              onChange={(e) => handleDraftChange('longBreakEvery', e.target.value)}
              onBlur={() => commitField('longBreakEvery')}
              onKeyDown={(e) => handleKeyDown('longBreakEvery', e)}
              aria-invalid={Boolean(errors.longBreakEvery)}
              aria-describedby={errors.longBreakEvery ? 'err-long-interval' : undefined}
            />
            {errors.longBreakEvery && (
              <p id="err-long-interval" className={styles.errorText} role="alert">
                {errors.longBreakEvery}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Automation and Audio Toggles */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Behavior</h3>
        <div className={styles.toggleList}>
          <label className={styles.toggleRow}>
            <div className={styles.toggleText}>
              <span className={styles.toggleTitle}>
                Start next phase automatically
              </span>
              <span className={styles.toggleDesc}>
                Transitions to the next work or break phase without waiting
              </span>
            </div>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={settings.autoStartNext}
              onChange={(e) => onChange({ autoStartNext: e.target.checked })}
            />
          </label>

          <label className={styles.toggleRow}>
            <div className={styles.toggleText}>
              <span className={styles.toggleTitle}>
                Play sound when a phase ends
              </span>
              <span className={styles.toggleDesc}>
                Plays a soothing chime notification at phase completion
              </span>
            </div>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={settings.chimeEnabled}
              onChange={(e) => onChange({ chimeEnabled: e.target.checked })}
            />
          </label>
        </div>
      </section>

      {/* Action footer */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.restoreBtn}
          onClick={handleRestore}
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>Restore defaults</span>
        </button>
      </div>

      <DemoDataNote />
    </div>
  );
}

export default TimerSettingsPanel;
