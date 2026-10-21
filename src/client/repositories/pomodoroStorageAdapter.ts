import type { PomodoroPhase, PomodoroSettings } from '../screens/dashboard/studyroom/types';
import { DEFAULT_POMODORO_SETTINGS } from '../screens/dashboard/studyroom/utils/pomodoroReducer';

export interface PomodoroStreakStats {
  completedFocusSessions: number;
  completedShortBreaks: number;
  completedLongBreaks: number;
  lastCompletedAt: number | null;
}

export interface PomodoroPersistedData {
  stats: PomodoroStreakStats;
  settings: PomodoroSettings;
}

const STORAGE_KEY = 'sidequest_pomodoro_data_v1';
const EVENT_NAME = 'sidequest_pomodoro_updated';

export const DEFAULT_POMODORO_STATS: PomodoroStreakStats = {
  completedFocusSessions: 0,
  completedShortBreaks: 0,
  completedLongBreaks: 0,
  lastCompletedAt: null,
};

let inMemoryData: PomodoroPersistedData = {
  stats: { ...DEFAULT_POMODORO_STATS },
  settings: { ...DEFAULT_POMODORO_SETTINGS },
};

let isHydrated = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Error in pomodoro storage subscriber:', e);
    }
  });
}

function hydrateFromLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PomodoroPersistedData>;
      inMemoryData = {
        stats: {
          ...DEFAULT_POMODORO_STATS,
          ...(parsed.stats || {}),
        },
        settings: {
          ...DEFAULT_POMODORO_SETTINGS,
          autoStartNext: true,
          ...(parsed.settings || {}),
        },
      };
    }
  } catch (e) {
    console.warn('Failed to parse pomodoro data from localStorage:', e);
  } finally {
    isHydrated = true;
  }
}

export const pomodoroStorageAdapter = {
  getPomodoroData(): PomodoroPersistedData {
    if (!isHydrated && typeof window !== 'undefined') {
      hydrateFromLocalStorage();
    }
    return {
      stats: { ...inMemoryData.stats },
      settings: { ...inMemoryData.settings },
    };
  },

  savePomodoroStats(statsPatch: Partial<PomodoroStreakStats>): PomodoroStreakStats {
    const current = this.getPomodoroData();
    const updatedStats: PomodoroStreakStats = {
      ...current.stats,
      ...statsPatch,
    };

    inMemoryData.stats = updatedStats;
    this.persist();
    return updatedStats;
  },

  savePomodoroSettings(settingsPatch: Partial<PomodoroSettings>): PomodoroSettings {
    const current = this.getPomodoroData();
    const updatedSettings: PomodoroSettings = {
      ...current.settings,
      ...settingsPatch,
    };

    inMemoryData.settings = updatedSettings;
    this.persist();
    return updatedSettings;
  },

  incrementPhaseStreak(phase: PomodoroPhase): PomodoroStreakStats {
    const current = this.getPomodoroData().stats;
    const now = Date.now();

    const patch: Partial<PomodoroStreakStats> = {
      lastCompletedAt: now,
    };

    if (phase === 'focus') {
      patch.completedFocusSessions = current.completedFocusSessions + 1;
    } else if (phase === 'shortBreak') {
      patch.completedShortBreaks = current.completedShortBreaks + 1;
    } else if (phase === 'longBreak') {
      patch.completedLongBreaks = current.completedLongBreaks + 1;
    }

    return this.savePomodoroStats(patch);
  },

  resetPomodoroStats(): void {
    inMemoryData.stats = { ...DEFAULT_POMODORO_STATS };
    this.persist();
  },

  resetToDefault(): void {
    inMemoryData = {
      stats: { ...DEFAULT_POMODORO_STATS },
      settings: { ...DEFAULT_POMODORO_SETTINGS },
    };
    this.persist();
  },

  persist(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
        window.dispatchEvent(new CustomEvent(EVENT_NAME));
      } catch (e) {
        console.error('Failed to save pomodoro data to localStorage:', e);
      }
    }
    notifySubscribers();
  },

  subscribe(callback: () => void): () => void {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },
};
