import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  PomodoroPhase,
  PomodoroSettings,
  PomodoroState,
} from '../types';
import {
  DEFAULT_POMODORO_SETTINGS,
  createInitialPomodoroState,
  pomodoroReducer,
} from '../utils/pomodoroReducer';
import { formatClock } from '../utils/formatTime';
import { playChime } from '../utils/chime';

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

export interface UsePomodoroReturn {
  state: PomodoroState;
  announcement: string;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => void;
  selectPhase: (phase: PomodoroPhase) => void;
  updateSettings: (patch: Partial<PomodoroSettings>) => void;
  restoreDefaults: () => void;
}

export function usePomodoro(
  roomTitle: string = 'Study Room',
  initialSettings?: Partial<PomodoroSettings>
): UsePomodoroReturn {
  const [state, dispatch] = useReducer(
    pomodoroReducer,
    initialSettings,
    createInitialPomodoroState
  );

  const lastCompletionSeqRef = useRef<number>(state.completionSeq);
  const previousTitleRef = useRef<string | null>(null);

  // Interval timer runs only while status === 'running' (250 ms ticks)
  useEffect(() => {
    if (state.status !== 'running') return;

    const intervalId = setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() });
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [state.status]);

  // Completion watcher: trigger audio chime on natural phase completion
  useEffect(() => {
    if (state.completionSeq === lastCompletionSeqRef.current) {
      return;
    }
    lastCompletionSeqRef.current = state.completionSeq;

    if (state.settings.chimeEnabled) {
      playChime();
    }
  }, [state.completionSeq, state.settings.chimeEnabled]);

  // Screen-reader announcement derived purely from state
  const announcement = useMemo(() => {
    if (state.completionSeq === 0) return '';
    if (state.lastCompletedPhase === 'focus') {
      const breakType = state.phase === 'longBreak' ? 'long' : 'short';
      return `Focus session complete. Time for a ${breakType} break.`;
    }
    if (
      state.lastCompletedPhase === 'shortBreak' ||
      state.lastCompletedPhase === 'longBreak'
    ) {
      return 'Break over. Ready to focus?';
    }
    return '';
  }, [state.completionSeq, state.lastCompletedPhase, state.phase]);

  // Document title updates when active; restores on reset to idle
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (state.status !== 'idle') {
      if (previousTitleRef.current === null) {
        previousTitleRef.current = document.title;
      }
      const secondsRemaining = Math.ceil(state.remainingMs / 1000);
      const clockStr = formatClock(secondsRemaining);
      const label = PHASE_LABELS[state.phase];
      const suffix = roomTitle ? ` — ${roomTitle}` : '';
      document.title = `${clockStr} · ${label}${suffix}`;
    } else if (previousTitleRef.current !== null) {
      document.title = previousTitleRef.current;
      previousTitleRef.current = null;
    }
  }, [state.status, state.remainingMs, state.phase, roomTitle]);

  // Restore document title on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined' && previousTitleRef.current !== null) {
        document.title = previousTitleRef.current;
        previousTitleRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    dispatch({ type: 'START', now: Date.now() });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE', now: Date.now() });
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'RESUME', now: Date.now() });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const skip = useCallback(() => {
    dispatch({ type: 'SKIP' });
  }, []);

  const selectPhase = useCallback((phase: PomodoroPhase) => {
    dispatch({ type: 'SELECT_PHASE', phase });
  }, []);

  const updateSettings = useCallback((patch: Partial<PomodoroSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', patch });
  }, []);

  const restoreDefaults = useCallback(() => {
    dispatch({ type: 'UPDATE_SETTINGS', patch: DEFAULT_POMODORO_SETTINGS });
  }, []);

  return {
    state,
    announcement,
    start,
    pause,
    resume,
    reset,
    skip,
    selectPhase,
    updateSettings,
    restoreDefaults,
  };
}
