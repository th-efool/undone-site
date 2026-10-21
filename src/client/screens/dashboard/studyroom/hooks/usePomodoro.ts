'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useSession } from 'next-auth/react';
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
import { pomodoroStorageAdapter } from '@/src/client/repositories/pomodoroStorageAdapter';
import { studyRoomRepository, type StudySessionDTO } from '@/src/client/repositories/studyRoomRepository';
import { useRealtime } from '@/src/client/realtime';

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' };
  }
}

function useSafeRealtime() {
  try {
    return useRealtime();
  } catch {
    return null;
  }
}

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
  initialSettings?: Partial<PomodoroSettings>,
  roomId?: string | null
): UsePomodoroReturn {
  const { data: session } = useSafeSession();
  const userId = session?.user?.id;
  const realtime = useSafeRealtime();

  const [state, dispatch] = useReducer(
    pomodoroReducer,
    undefined,
    () => {
      const data = pomodoroStorageAdapter.getPomodoroData();
      return createInitialPomodoroState(
        { ...data.settings, ...initialSettings },
        data.stats
      );
    }
  );

  const lastCompletionSeqRef = useRef<number>(state.completionSeq);
  const previousTitleRef = useRef<string | null>(null);
  const serverSessionRef = useRef<StudySessionDTO | null>(null);
  const clockOffsetMsRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Synchronize state with an authoritative server session
  const syncFromServer = useCallback((dto: StudySessionDTO | null) => {
    serverSessionRef.current = dto;
    if (!dto || !isMountedRef.current) return;

    const serverTimeMs = new Date(dto.serverTime).getTime();
    const clockOffset = Date.now() - serverTimeMs;
    clockOffsetMsRef.current = clockOffset;

    const durationMs = dto.targetDurationSeconds * 1000;

    if (dto.status === 'ACTIVE' && dto.deadline) {
      const serverDeadlineMs = new Date(dto.deadline).getTime();
      const adjustedDeadlineMs = serverDeadlineMs + clockOffset;
      const remainingMs = Math.max(0, adjustedDeadlineMs - Date.now());

      if (remainingMs > 0) {
        dispatch({
          type: 'SYNC_SERVER_SESSION',
          status: 'running',
          phase: 'focus',
          phaseDurationMs: durationMs,
          remainingMs,
          endsAt: adjustedDeadlineMs,
        });
      } else {
        // Natural deadline passed while away/disconnected
        void studyRoomRepository
          .completeSession(dto.id, dto.version)
          .catch(() => {});
        serverSessionRef.current = null;
      }
    } else if (dto.status === 'PAUSED') {
      const remainingMs = Math.max(
        0,
        (dto.targetDurationSeconds - dto.elapsedSeconds) * 1000
      );
      dispatch({
        type: 'SYNC_SERVER_SESSION',
        status: 'paused',
        phase: 'focus',
        phaseDurationMs: durationMs,
        remainingMs,
        endsAt: null,
      });
    } else if (dto.status === 'COMPLETED' || dto.status === 'INTERRUPTED') {
      serverSessionRef.current = null;
    }
  }, []);

  // 1. Initial mount: query server for active session
  useEffect(() => {
    isMountedRef.current = true;
    let ignore = false;

    void Promise.resolve().then(async () => {
      try {
        const active = await studyRoomRepository.getActiveSession();
        if (!ignore && isMountedRef.current && active) {
          syncFromServer(active);
        }
      } catch {
        // Safe degraded fallback to local storage
      }
    });

    return () => {
      ignore = true;
      isMountedRef.current = false;
    };
  }, [syncFromServer]);

  // 2. Realtime subscription to user channel for cross-device sync
  useEffect(() => {
    if (!userId || typeof realtime?.subscribe !== 'function') return;

    const userChannel = `user:${userId}:g1`;
    const unsubscribe = realtime.subscribe(userChannel, (data: unknown) => {
      const envelope = data as {
        type?: string;
        payload?: StudySessionDTO;
        session?: StudySessionDTO;
      };
      const incoming = envelope?.payload || envelope?.session;
      if (envelope?.type === 'study.session.updated' && incoming) {
        syncFromServer(incoming);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId, realtime, syncFromServer]);

  // 3. Sleeping tab / tab wake-up handling (visibilitychange & focus)
  useEffect(() => {
    const handleWake = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        const cur = serverSessionRef.current;
        if (cur && cur.status === 'ACTIVE' && cur.deadline) {
          const adjustedDeadlineMs =
            new Date(cur.deadline).getTime() + clockOffsetMsRef.current;
          const remaining = Math.max(0, adjustedDeadlineMs - Date.now());

          if (remaining <= 0) {
            void studyRoomRepository
              .completeSession(cur.id, cur.version)
              .catch(() => {});
            serverSessionRef.current = null;
            dispatch({ type: 'TICK', now: Date.now() });
          } else {
            dispatch({
              type: 'SYNC_SERVER_SESSION',
              status: 'running',
              phase: 'focus',
              phaseDurationMs: cur.targetDurationSeconds * 1000,
              remainingMs: remaining,
              endsAt: adjustedDeadlineMs,
            });
          }
        }

        // Fetch authoritative server state to reconcile actions from other devices
        void studyRoomRepository
          .getActiveSession()
          .then((fresh) => {
            if (fresh && isMountedRef.current) {
              syncFromServer(fresh);
            }
          })
          .catch(() => {});
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleWake);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWake);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleWake);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWake);
      }
    };
  }, [syncFromServer]);

  // 4. Interval timer runs only while status === 'running' (250 ms ticks)
  useEffect(() => {
    if (state.status !== 'running') return;

    const intervalId = setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() });
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [state.status]);

  // 5. Completion watcher: trigger audio chime, save streaks, & complete server session
  useEffect(() => {
    if (state.completionSeq === lastCompletionSeqRef.current) {
      return;
    }
    lastCompletionSeqRef.current = state.completionSeq;

    // If focus phase finished, finalize the server session
    if (state.lastCompletedPhase === 'focus' && serverSessionRef.current) {
      const currentSess = serverSessionRef.current;
      void studyRoomRepository
        .completeSession(currentSess.id, currentSess.version)
        .catch(() => {});
      serverSessionRef.current = null;
    }

    pomodoroStorageAdapter.savePomodoroStats({
      completedFocusSessions: state.completedFocusSessions,
      completedShortBreaks: state.completedShortBreaks,
      completedLongBreaks: state.completedLongBreaks,
      lastCompletedAt: Date.now(),
    });

    if (state.settings.chimeEnabled) {
      playChime();
    }
  }, [
    state.completionSeq,
    state.settings.chimeEnabled,
    state.completedFocusSessions,
    state.completedShortBreaks,
    state.completedLongBreaks,
    state.lastCompletedPhase,
  ]);

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

  // 6. Commands
  const start = useCallback(() => {
    const now = Date.now();
    dispatch({ type: 'START', now });

    if (state.phase === 'focus') {
      const durationSeconds = state.settings.focusMinutes * 60;
      void studyRoomRepository
        .startSession(durationSeconds, roomId)
        .then((sessionDto) => {
          syncFromServer(sessionDto);
        })
        .catch(() => {
          // Graceful degraded fallback in mock/offline environments
        });
    }
  }, [state.phase, state.settings.focusMinutes, roomId, syncFromServer]);

  const pause = useCallback(() => {
    const now = Date.now();
    dispatch({ type: 'PAUSE', now });

    const cur = serverSessionRef.current;
    if (cur && state.phase === 'focus') {
      void studyRoomRepository
        .pauseSession(cur.id, cur.version)
        .then((updated) => {
          serverSessionRef.current = updated;
        })
        .catch((err) => {
          if (err?.status === 409) {
            void studyRoomRepository
              .getActiveSession()
              .then(syncFromServer)
              .catch(() => {});
          }
        });
    }
  }, [state.phase, syncFromServer]);

  const resume = useCallback(() => {
    const now = Date.now();
    dispatch({ type: 'RESUME', now });

    const cur = serverSessionRef.current;
    if (cur && state.phase === 'focus') {
      void studyRoomRepository
        .resumeSession(cur.id, cur.version)
        .then((updated) => {
          syncFromServer(updated);
        })
        .catch((err) => {
          if (err?.status === 409) {
            void studyRoomRepository
              .getActiveSession()
              .then(syncFromServer)
              .catch(() => {});
          }
        });
    }
  }, [state.phase, syncFromServer]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });

    const cur = serverSessionRef.current;
    if (cur) {
      void studyRoomRepository
        .interruptSession(cur.id, cur.version)
        .catch(() => {});
      serverSessionRef.current = null;
    }
  }, []);

  const skip = useCallback(() => {
    dispatch({ type: 'SKIP' });

    const cur = serverSessionRef.current;
    if (cur) {
      void studyRoomRepository
        .interruptSession(cur.id, cur.version)
        .catch(() => {});
      serverSessionRef.current = null;
    }
  }, []);

  const selectPhase = useCallback(
    (phase: PomodoroPhase) => {
      dispatch({ type: 'SELECT_PHASE', phase });
      // Selecting another phase interrupts any active server focus session
      const cur = serverSessionRef.current;
      if (cur) {
        void studyRoomRepository
          .interruptSession(cur.id, cur.version)
          .catch(() => {});
        serverSessionRef.current = null;
      }
    },
    []
  );

  const updateSettings = useCallback((patch: Partial<PomodoroSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', patch });
    pomodoroStorageAdapter.savePomodoroSettings(patch);
  }, []);

  const restoreDefaults = useCallback(() => {
    dispatch({ type: 'UPDATE_SETTINGS', patch: DEFAULT_POMODORO_SETTINGS });
    pomodoroStorageAdapter.savePomodoroSettings(DEFAULT_POMODORO_SETTINGS);
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
