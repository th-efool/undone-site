import type {
  PomodoroAction,
  PomodoroPhase,
  PomodoroSettings,
  PomodoroState,
} from '../types';

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartNext: false,
  chimeEnabled: true,
};

export const SETTING_LIMITS = {
  focusMinutes: { min: 1, max: 120 },
  shortBreakMinutes: { min: 1, max: 30 },
  longBreakMinutes: { min: 1, max: 60 },
  longBreakEvery: { min: 2, max: 8 },
} as const;

/**
 * Validates and clamps a single setting to its allowed range.
 * Returns null if the value cannot be parsed or is invalid (e.g. NaN, non-integer).
 */
export function clampSetting(
  key: keyof PomodoroSettings,
  raw: unknown
): number | boolean | null {
  if (key === 'autoStartNext' || key === 'chimeEnabled') {
    return typeof raw === 'boolean' ? raw : null;
  }

  const limits = SETTING_LIMITS[key as keyof typeof SETTING_LIMITS];
  if (!limits) return null;

  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(num)) {
    return null;
  }

  const rounded = Math.round(num);
  return Math.max(limits.min, Math.min(limits.max, rounded));
}

export function phaseMinutes(phase: PomodoroPhase, settings: PomodoroSettings): number {
  switch (phase) {
    case 'focus':
      return settings.focusMinutes;
    case 'shortBreak':
      return settings.shortBreakMinutes;
    case 'longBreak':
      return settings.longBreakMinutes;
  }
}

export function nextPhaseAfterCompletion(
  currentPhase: PomodoroPhase,
  completedFocusSessions: number,
  longBreakEvery: number
): PomodoroPhase {
  if (currentPhase === 'focus') {
    return completedFocusSessions % longBreakEvery === 0 ? 'longBreak' : 'shortBreak';
  }
  return 'focus';
}

export function createInitialPomodoroState(
  settingsOverrides?: Partial<PomodoroSettings>
): PomodoroState {
  const settings: PomodoroSettings = {
    ...DEFAULT_POMODORO_SETTINGS,
    ...settingsOverrides,
  };
  const durationMs = settings.focusMinutes * 60_000;

  return {
    settings,
    phase: 'focus',
    status: 'idle',
    phaseDurationMs: durationMs,
    remainingMs: durationMs,
    endsAt: null,
    completedFocusSessions: 0,
    completionSeq: 0,
    lastCompletedPhase: null,
  };
}

export function pomodoroReducer(
  state: PomodoroState,
  action: PomodoroAction
): PomodoroState {
  switch (action.type) {
    case 'START': {
      if (state.status !== 'idle') return state;
      const durationMs = phaseMinutes(state.phase, state.settings) * 60_000;
      return {
        ...state,
        status: 'running',
        phaseDurationMs: durationMs,
        remainingMs: durationMs,
        endsAt: action.now + durationMs,
      };
    }

    case 'PAUSE': {
      if (state.status !== 'running') return state;
      const remainingMs = Math.max(0, (state.endsAt ?? action.now) - action.now);
      return {
        ...state,
        status: 'paused',
        remainingMs,
        endsAt: null,
      };
    }

    case 'RESUME': {
      if (state.status !== 'paused') return state;
      return {
        ...state,
        status: 'running',
        endsAt: action.now + state.remainingMs,
      };
    }

    case 'RESET': {
      const durationMs = phaseMinutes(state.phase, state.settings) * 60_000;
      return {
        ...state,
        status: 'idle',
        phaseDurationMs: durationMs,
        remainingMs: durationMs,
        endsAt: null,
      };
    }

    case 'SELECT_PHASE': {
      const durationMs = phaseMinutes(action.phase, state.settings) * 60_000;
      return {
        ...state,
        phase: action.phase,
        status: 'idle',
        phaseDurationMs: durationMs,
        remainingMs: durationMs,
        endsAt: null,
      };
    }

    case 'SKIP': {
      const nextPhase: PomodoroPhase =
        state.phase === 'focus' ? 'shortBreak' : 'focus';
      const durationMs = phaseMinutes(nextPhase, state.settings) * 60_000;
      return {
        ...state,
        phase: nextPhase,
        status: 'idle',
        phaseDurationMs: durationMs,
        remainingMs: durationMs,
        endsAt: null,
      };
    }

    case 'TICK': {
      if (state.status !== 'running' || state.endsAt === null) {
        return state;
      }

      if (action.now < state.endsAt) {
        return {
          ...state,
          remainingMs: state.endsAt - action.now,
        };
      }

      // Natural completion! Exactly one phase transition per TICK.
      const newCompleted =
        state.phase === 'focus'
          ? state.completedFocusSessions + 1
          : state.completedFocusSessions;

      const nextPhase = nextPhaseAfterCompletion(
        state.phase,
        newCompleted,
        state.settings.longBreakEvery
      );
      const nextDurationMs = phaseMinutes(nextPhase, state.settings) * 60_000;

      if (state.settings.autoStartNext) {
        return {
          ...state,
          phase: nextPhase,
          status: 'running',
          phaseDurationMs: nextDurationMs,
          remainingMs: nextDurationMs,
          endsAt: action.now + nextDurationMs,
          completedFocusSessions: newCompleted,
          completionSeq: state.completionSeq + 1,
          lastCompletedPhase: state.phase,
        };
      }

      return {
        ...state,
        phase: nextPhase,
        status: 'idle',
        phaseDurationMs: nextDurationMs,
        remainingMs: nextDurationMs,
        endsAt: null,
        completedFocusSessions: newCompleted,
        completionSeq: state.completionSeq + 1,
        lastCompletedPhase: state.phase,
      };
    }

    case 'UPDATE_SETTINGS': {
      const validPatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(action.patch)) {
        const clamped = clampSetting(k as keyof PomodoroSettings, v);
        if (clamped !== null) {
          validPatch[k] = clamped;
        }
      }

      if (Object.keys(validPatch).length === 0) {
        return state;
      }

      const newSettings: PomodoroSettings = {
        ...state.settings,
        ...validPatch,
      };

      // When idle, immediately apply if the current phase's duration changed
      if (state.status === 'idle') {
        const durationMs = phaseMinutes(state.phase, newSettings) * 60_000;
        return {
          ...state,
          settings: newSettings,
          phaseDurationMs: durationMs,
          remainingMs: durationMs,
        };
      }

      // When running or paused: duration countdown is preserved
      return {
        ...state,
        settings: newSettings,
      };
    }

    default:
      return state;
  }
}
