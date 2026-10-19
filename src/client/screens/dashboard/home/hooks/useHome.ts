import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { homeRepository } from '@/src/client/repositories/homeRepository';
import { homeStorageAdapter } from '@/src/client/repositories/homeStorageAdapter';
import type { Weekday, ActiveCohort, PausedCohort, CompletedCourse } from '../models';
import type { CohortLearningSettings } from '../components/ActiveCohorts/ActiveCohorts';
import {
  getActiveCohorts,
  pauseCohort,
  reorderCohorts,
  resumeCohort,
  updateDailyGoal,
  updateSchedule,
  updateOrderStyle,
  updateFrequency,
} from '../utils';

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

async function syncWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  delayMs = 500
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

export function useHome(props?: { 
  activeCohorts?: ActiveCohort[];
  continueLater?: PausedCohort[];
  recentlyCompleted?: CompletedCourse[];
}) {
  const { data: session, status: authStatus } = useSafeSession();
  const isAuthenticated = authStatus === 'authenticated' && !!session?.user?.id;

  const { data: homeData, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: async () => homeRepository.getHome({ loadStored: true }),
    initialData: () => homeRepository.getHome({ loadStored: typeof window !== 'undefined' }),
  });

  const source = homeData ?? homeRepository.getHome();
  const home = {
    ...source,
    activeCohorts: props?.activeCohorts ?? source.activeCohorts,
    continueLater: props?.continueLater ?? source.continueLater,
    recentlyCompleted: props?.recentlyCompleted ?? source.recentlyCompleted,
  };

  const initialCohorts = useMemo(() => {
    const hasServerData =
      props?.activeCohorts !== undefined || props?.continueLater !== undefined;
    if (hasServerData) {
      return getActiveCohorts(props?.activeCohorts ?? [], props?.continueLater ?? []);
    }
    return getActiveCohorts(home.activeCohorts, home.continueLater);
  }, [props?.activeCohorts, props?.continueLater, home.activeCohorts, home.continueLater]);

  const [activeCohorts, setActiveCohorts] = useState(initialCohorts.activeCohorts);
  const [continueLater, setContinueLater] = useState(initialCohorts.continueLater);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const cohortTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Background pluggable backend sync and local choice hydration
  useEffect(() => {
    // 1. Hydrate from local storage first if no server cohorts were passed
    const hasServerCohorts =
      props?.activeCohorts !== undefined || props?.continueLater !== undefined;
    if (!hasServerCohorts) {
      const stored = homeStorageAdapter.getStoredChoices();
      if (stored) {
        if (Array.isArray(stored.activeCohorts) && stored.activeCohorts.length > 0) {
          setActiveCohorts(stored.activeCohorts);
        }
        if (Array.isArray(stored.continueLater)) {
          setContinueLater(stored.continueLater);
        }
      }
    }

    // 2. Only perform remote backend sync if authenticated to prevent 401 console spam
    if (isAuthenticated && !hasServerCohorts) {
      homeStorageAdapter
        .syncWithBackend(true)
        .then((synced) => {
          if (synced?.activeCohorts) {
            setActiveCohorts(synced.activeCohorts);
          }
          if (synced?.continueLater) {
            setContinueLater(synced.continueLater);
          }
        })
        .catch(() => {});
    }
  }, [props?.activeCohorts, props?.continueLater, isAuthenticated]);

  const debouncedSyncCohort = useCallback(
    (
      cohortId: string,
      config: Omit<Partial<ActiveCohort>, 'pausedUntil' | 'pausedReason'> & {
        isPaused?: boolean;
        pausedUntil?: string | Date;
        pausedReason?: string;
      },
      rollbackSnapshot?: { activeCohorts: ActiveCohort[]; continueLater: PausedCohort[] }
    ) => {
      const existingTimer = cohortTimers.current.get(cohortId);
      if (existingTimer) clearTimeout(existingTimer);

      // Unauthenticated users don't make remote calls — localStorage handles persistence cleanly
      if (!isAuthenticated) return;

      setIsSyncing(true);
      const timer = setTimeout(async () => {
        cohortTimers.current.delete(cohortId);
        try {
          const res = await syncWithRetry('/api/user/cohort-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cohortId,
              rank: config.rank,
              dailyGoalMinutes: config.dailyGoalMinutes,
              scheduleDays: config.schedule?.days,
              scheduleLabel: config.schedule?.label,
              frequency: config.frequency,
              orderStyle: config.orderStyle,
              isPaused: config.isPaused,
              pausedUntil: config.pausedUntil,
              pausedReason: config.pausedReason,
            }),
          });

          if (!res.ok) {
            if (res.status === 401) return;
            console.warn(`[useHome] Failed to sync cohort config for ${cohortId}: HTTP ${res.status}`);
            if (rollbackSnapshot) {
              setActiveCohorts(rollbackSnapshot.activeCohorts);
              setContinueLater(rollbackSnapshot.continueLater);
              homeStorageAdapter.saveChoices(rollbackSnapshot.activeCohorts, rollbackSnapshot.continueLater);
            }
            setSyncError(`Failed to save changes (${res.statusText})`);
          } else {
            setSyncError(null);
          }
        } catch (err) {
          console.warn(`[useHome] Persistent network failure syncing cohort ${cohortId}:`, err);
          if (rollbackSnapshot) {
            setActiveCohorts(rollbackSnapshot.activeCohorts);
            setContinueLater(rollbackSnapshot.continueLater);
            homeStorageAdapter.saveChoices(rollbackSnapshot.activeCohorts, rollbackSnapshot.continueLater);
          }
          setSyncError('Connection issue: changes rolled back.');
        } finally {
          setIsSyncing(false);
        }
      }, 800);
      cohortTimers.current.set(cohortId, timer);
    },
    [isAuthenticated]
  );

  // Sync state if non-empty server props change
  useEffect(() => {
    if (props?.activeCohorts !== undefined || props?.continueLater !== undefined) {
      const normalized = getActiveCohorts(props.activeCohorts ?? [], props.continueLater ?? []);
      setActiveCohorts(normalized.activeCohorts);
      setContinueLater(normalized.continueLater);
    }
  }, [props?.activeCohorts, props?.continueLater]);

  // Automatically persist user choice mutations to local storage
  useEffect(() => {
    homeStorageAdapter.saveChoices(activeCohorts, continueLater);
  }, [activeCohorts, continueLater]);

  useEffect(() => {
    if (!continueLater.length) return;
    const now = Date.now();
    const hasExpired = continueLater.some((cohort) => {
      if (!cohort.pausedUntil) return false;
      const t = new Date(cohort.pausedUntil).getTime();
      return Number.isFinite(t) && t <= now;
    });

    if (hasExpired) {
      const normalized = getActiveCohorts(activeCohorts, continueLater);
      setActiveCohorts(normalized.activeCohorts);
      setContinueLater(normalized.continueLater);
      return;
    }

    const validExpiries = continueLater
      .map((cohort) => cohort.pausedUntil ? new Date(cohort.pausedUntil).getTime() : NaN)
      .filter((time) => Number.isFinite(time) && time > now);
    if (!validExpiries.length) return;
    const expiry = Math.min(...validExpiries);
    const timer = setTimeout(() => {
      const normalized = getActiveCohorts(activeCohorts, continueLater);
      setActiveCohorts(normalized.activeCohorts);
      setContinueLater(normalized.continueLater);
    }, Math.min(2_147_483_647, Math.max(0, expiry - now) + 10));
    return () => clearTimeout(timer);
  }, [activeCohorts, continueLater]);

  const summaries = useMemo(
    () =>
      home.summaries.map((summary) => {
        if (summary.id === 'active-cohorts') {
          return { ...summary, value: String(activeCohorts.length) };
        }

        return summary;
      }),
    [activeCohorts.length, home.summaries],
  );

  function moveCohort(draggedId: string, targetId: string) {
    const previousActive = [...activeCohorts];
    const reordered = reorderCohorts(activeCohorts, draggedId, targetId);
    setActiveCohorts(reordered);

    if (!isAuthenticated) return;

    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    setIsSyncing(true);
    reorderTimerRef.current = setTimeout(async () => {
      try {
        const res = await syncWithRetry('/api/user/cohort-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cohorts: reordered.map((c, idx) => ({
              cohortId: c.cohortId || c.id,
              rank: idx + 1,
            })),
          }),
        });

        if (!res.ok && res.status !== 401) {
          console.warn('[useHome] Persistent error syncing cohort order:', res.statusText);
          setActiveCohorts(previousActive);
          homeStorageAdapter.saveChoices(previousActive, continueLater);
          setSyncError('Could not save cohort order to server.');
        } else {
          setSyncError(null);
        }
      } catch (err) {
        console.warn('[useHome] Persistent network failure reordering cohorts:', err);
        setActiveCohorts(previousActive);
        homeStorageAdapter.saveChoices(previousActive, continueLater);
        setSyncError('Network issue: cohort order was rolled back.');
      } finally {
        setIsSyncing(false);
      }
    }, 500);
  }

  function saveSchedule(cohortId: string, days: Weekday[]) {
    const snapshot = { activeCohorts, continueLater };
    const updated = updateSchedule(activeCohorts, cohortId, days);
    setActiveCohorts(updated);
    const cohort = updated.find(c => (c.cohortId || c.id) === cohortId || c.id === cohortId);
    const cleanId = cohort?.cohortId || cohort?.id || cohortId;
    if (cohort) debouncedSyncCohort(cleanId, cohort, snapshot);
  }

  function saveDailyGoal(cohortId: string, minutes: number) {
    const snapshot = { activeCohorts, continueLater };
    const updated = updateDailyGoal(activeCohorts, cohortId, minutes);
    setActiveCohorts(updated);
    const cohort = updated.find(c => (c.cohortId || c.id) === cohortId || c.id === cohortId);
    const cleanId = cohort?.cohortId || cohort?.id || cohortId;
    if (cohort) debouncedSyncCohort(cleanId, cohort, snapshot);
  }

  function saveOrderStyle(cohortId: string, style: 'Sequential' | 'Semantic Randomize' | 'Randomize') {
    const snapshot = { activeCohorts, continueLater };
    const updated = updateOrderStyle(activeCohorts, cohortId, style);
    setActiveCohorts(updated);
    const cohort = updated.find(c => (c.cohortId || c.id) === cohortId || c.id === cohortId);
    const cleanId = cohort?.cohortId || cohort?.id || cohortId;
    if (cohort) debouncedSyncCohort(cleanId, cohort, snapshot);
  }

  function saveFrequency(cohortId: string, frequency: 'Very Often' | 'Often' | 'Sometimes' | 'Rarely' | 'Very Rarely') {
    const snapshot = { activeCohorts, continueLater };
    const updated = updateFrequency(activeCohorts, cohortId, frequency);
    setActiveCohorts(updated);
    const cohort = updated.find(c => (c.cohortId || c.id) === cohortId || c.id === cohortId);
    const cleanId = cohort?.cohortId || cohort?.id || cohortId;
    if (cohort) debouncedSyncCohort(cleanId, cohort, snapshot);
  }

  async function pauseActiveCohort(cohortId: string, pausedUntil?: Date, pausedReason?: string) {
    if (!isAuthenticated) throw new Error('Sign in to pause a cohort');
    if (pausedUntil && (!Number.isFinite(pausedUntil.getTime()) || pausedUntil <= new Date())) {
      throw new Error('Choose a future pause date');
    }
    const activeCohort = activeCohorts.find((c) => (c.cohortId || c.id) === cohortId || c.id === cohortId);
    if (!activeCohort) throw new Error('Cohort not found');
    const cleanId = activeCohort?.cohortId || activeCohort?.id || cohortId;
    const response = await syncWithRetry('/api/user/cohort-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cohortId: cleanId,
        rank: activeCohort.rank,
        isPaused: true,
        pausedUntil: pausedUntil ? pausedUntil.toISOString() : null,
        pausedReason,
      }),
    });
    if (!response.ok) throw new Error('Could not save cohort pause');
    const result = pauseCohort(activeCohorts, continueLater, cleanId, pausedUntil, pausedReason);
    setActiveCohorts(result.activeCohorts);
    setContinueLater(result.continueLater);
  }

  async function resumePausedCohort(cohortId: string) {
    if (!isAuthenticated) throw new Error('Sign in to resume a cohort');
    const pausedCohort = continueLater.find(c => (c.cohortId || c.id) === cohortId || c.id === cohortId);
    if (!pausedCohort) throw new Error('Cohort not found');
    const cleanId = pausedCohort?.cohortId || pausedCohort?.id || cohortId;
    const response = await syncWithRetry('/api/user/cohort-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cohortId: cleanId, isPaused: false, pausedUntil: null }),
    });
    if (!response.ok) throw new Error('Could not save cohort resume');
    const result = resumeCohort(activeCohorts, continueLater, cleanId);
    setActiveCohorts(result.activeCohorts);
    setContinueLater(result.continueLater);
  }

  async function saveLearningSettings(cohortId: string, settings: CohortLearningSettings) {
    if (!isAuthenticated) throw new Error('Sign in to save learning settings');
    if (settings.dailyGoalMinutes < 5 || settings.dailyGoalMinutes > 180 || !settings.schedule.days.length) {
      throw new Error('Invalid learning settings');
    }
    if (isAuthenticated) {
      const response = await syncWithRetry('/api/user/cohort-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId, dailyGoalMinutes: settings.dailyGoalMinutes,
          scheduleDays: settings.schedule.days, scheduleLabel: settings.schedule.label, orderStyle: settings.orderStyle }),
      });
      if (!response.ok) throw new Error('Could not save learning settings');
    }
    const apply = <T extends ActiveCohort | PausedCohort>(cohort: T): T =>
      (cohort.cohortId || cohort.id) === cohortId ? { ...cohort, ...settings } : cohort;
    setActiveCohorts((cohorts) => cohorts.map(apply));
    setContinueLater((cohorts) => cohorts.map(apply));
  }

  async function removeSubscribedCohort(cohortId: string) {
    if (!isAuthenticated) throw new Error('Sign in to remove a subscription');
    const timer = cohortTimers.current.get(cohortId);
    if (timer) clearTimeout(timer);
    cohortTimers.current.delete(cohortId);
    if (isAuthenticated) {
      const response = await syncWithRetry('/api/cohort/' + encodeURIComponent(cohortId) + '/join', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not remove subscription');
    }
    setActiveCohorts((cohorts) => cohorts.filter((cohort) => (cohort.cohortId || cohort.id) !== cohortId));
    setContinueLater((cohorts) => cohorts.filter((cohort) => (cohort.cohortId || cohort.id) !== cohortId));
  }

  return {
    loading: isLoading,
    isSyncing,
    syncError,
    isAuthenticated,
    ...home,
    summaries,
    activeCohorts,
    continueLater,
    actions: {
      moveCohort,
      pauseActiveCohort,
      resumePausedCohort,
      saveLearningSettings,
      removeSubscribedCohort,
      saveDailyGoal,
      saveSchedule,
      saveOrderStyle,
      saveFrequency,
    },
  };
}

export type UseHomeResult = ReturnType<typeof useHome>;

