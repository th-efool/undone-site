/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pomodoroStorageAdapter,
  DEFAULT_POMODORO_STATS,
} from '../pomodoroStorageAdapter';

describe('pomodoroStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
    pomodoroStorageAdapter.resetToDefault();
    vi.clearAllMocks();
  });

  it('provides default stats and settings initially', () => {
    const data = pomodoroStorageAdapter.getPomodoroData();
    expect(data.stats.completedFocusSessions).toBe(0);
    expect(data.stats.completedShortBreaks).toBe(0);
    expect(data.stats.completedLongBreaks).toBe(0);
    expect(data.settings.focusMinutes).toBe(25);
    expect(data.settings.autoStartNext).toBe(false);
  });

  it('increments focus, short break, and long break streaks independently', () => {
    // 1. Focus session
    pomodoroStorageAdapter.incrementPhaseStreak('focus');
    let data = pomodoroStorageAdapter.getPomodoroData();
    expect(data.stats.completedFocusSessions).toBe(1);
    expect(data.stats.completedShortBreaks).toBe(0);
    expect(data.stats.completedLongBreaks).toBe(0);
    expect(data.stats.lastCompletedAt).toBeTruthy();

    // 2. Short break
    pomodoroStorageAdapter.incrementPhaseStreak('shortBreak');
    data = pomodoroStorageAdapter.getPomodoroData();
    expect(data.stats.completedFocusSessions).toBe(1);
    expect(data.stats.completedShortBreaks).toBe(1);
    expect(data.stats.completedLongBreaks).toBe(0);

    // 3. Long break
    pomodoroStorageAdapter.incrementPhaseStreak('longBreak');
    data = pomodoroStorageAdapter.getPomodoroData();
    expect(data.stats.completedFocusSessions).toBe(1);
    expect(data.stats.completedShortBreaks).toBe(1);
    expect(data.stats.completedLongBreaks).toBe(1);
  });

  it('persists and reloads stats and settings across simulated page reload', () => {
    pomodoroStorageAdapter.savePomodoroStats({
      completedFocusSessions: 5,
      completedShortBreaks: 4,
      completedLongBreaks: 1,
    });
    pomodoroStorageAdapter.savePomodoroSettings({
      focusMinutes: 50,
      shortBreakMinutes: 10,
      longBreakEvery: 3,
    });

    const raw = localStorage.getItem('sidequest_pomodoro_data_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.stats.completedFocusSessions).toBe(5);
    expect(parsed.settings.focusMinutes).toBe(50);
    expect(parsed.settings.longBreakEvery).toBe(3);

    // Verify getter returns persisted data
    const loaded = pomodoroStorageAdapter.getPomodoroData();
    expect(loaded.stats.completedFocusSessions).toBe(5);
    expect(loaded.stats.completedShortBreaks).toBe(4);
    expect(loaded.stats.completedLongBreaks).toBe(1);
    expect(loaded.settings.focusMinutes).toBe(50);
    expect(loaded.settings.shortBreakMinutes).toBe(10);
    expect(loaded.settings.longBreakEvery).toBe(3);
  });

  it('notifies subscribers when data changes', () => {
    const subscriber = vi.fn();
    const unsubscribe = pomodoroStorageAdapter.subscribe(subscriber);

    pomodoroStorageAdapter.incrementPhaseStreak('focus');
    expect(subscriber).toHaveBeenCalledTimes(1);

    pomodoroStorageAdapter.savePomodoroSettings({ focusMinutes: 30 });
    expect(subscriber).toHaveBeenCalledTimes(2);

    unsubscribe();
    pomodoroStorageAdapter.incrementPhaseStreak('focus');
    expect(subscriber).toHaveBeenCalledTimes(2);
  });
});
