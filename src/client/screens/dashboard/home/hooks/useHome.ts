import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { homeRepository } from '@/src/client/repositories/homeRepository';
import { homeStorageAdapter } from '@/src/client/repositories/homeStorageAdapter';
import type { Weekday, ActiveCohort, PausedCohort, CompletedCourse } from '../models';
import {
  addDays,
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
  let lastError: any;
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
  });

  const home = homeData ?? homeRepository.getHome();
  
  if (props?.activeCohorts) home.activeCohorts = props.activeCohorts;
  if (props?.continueLater) home.continueLater = props.continueLater;
  if (props?.recentlyCompleted) home.recentlyCompleted = props.recentlyCompleted;

  const initialCohorts = useMemo(() => {
    const hasServerData =
      (props?.activeCohorts && props.activeCohorts.length > 0) ||
      (props?.continueLater && props.continueLater.length > 0);
    if (hasServerData) {
      return {
        activeCohorts: props?.activeCohorts ?? [],
        continueLater: props?.continueLater ?? [],
      };
    }
    return getActiveCohorts(home.activeCohorts, home.continueLater);
  }, [props?.activeCohorts, props?.continueLater, home.activeCohorts, home.continueLater]);

  const [activeCohorts, setActiveCohorts] = useState(initialCohorts.activeCohorts);
  const [continueLater, setContinueLater] = useState(initialCohorts.continueLater);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Background pluggable backend sync and local choice hydration
  useEffect(() => {
    // 1. Hydrate from local storage first if no server cohorts were passed
    const hasServerCohorts =
      (props?.activeCohorts && props.activeCohorts.length > 0) ||
      (props?.continueLater && props.continueLater.length > 0);
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
    if (isAuthenticated) {
      homeStorageAdapter
        .syncWithBackend(true)
        .then((synced) => {
          if (synced?.activeCohorts && synced.activeCohorts.length > 0) {
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
      config: Partial<ActiveCohort> & {
        isPaused?: boolean;
        pausedUntil?: string | Date;
        pausedReason?: string;
      },
      rollbackSnapshot?: { activeCohorts: ActiveCohort[]; continueLater: PausedCohort[] }
    ) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

      // Unauthenticated users don't make remote calls — localStorage handles persistence cleanly
      if (!isAuthenticated) return;

      setIsSyncing(true);
      syncTimerRef.current = setTimeout(async () => {
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
    },
    [isAuthenticated]
  );

  // Sync state if non-empty server props change
  useEffect(() => {
    if (props?.activeCohorts && props.activeCohorts.length > 0) setActiveCohorts(props.activeCohorts);
    if (props?.continueLater && props.continueLater.length > 0) setContinueLater(props.continueLater);
  }, [props?.activeCohorts, props?.continueLater]);

  // Automatically persist user choice mutations to local storage
  useEffect(() => {
    if (activeCohorts.length > 0 || continueLater.length > 0) {
      homeStorageAdapter.saveChoices(activeCohorts, continueLater);
    }
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

  function pauseActiveCohort(cohortId: string, days: number, pausedReason?: string) {
    const pausedUntil = addDays(new Date(), days);
    const snapshot = { activeCohorts, continueLater };

    const activeCohort = activeCohorts.find((c) => (c.cohortId || c.id) === cohortId || c.id === cohortId);
    const cleanId = activeCohort?.cohortId || activeCohort?.id || cohortId;
    const result = pauseCohort(activeCohorts, continueLater, cleanId, pausedUntil, pausedReason);

    setActiveCohorts(result.activeCohorts);
    setContinueLater(result.continueLater);

    const paused = result.continueLater.find((c) => (c.cohortId || c.id) === cleanId || c.id === cleanId);
    debouncedSyncCohort(
      cleanId,
      {
        rank: activeCohort?.rank,
        dailyGoalMinutes: paused?.dailyGoalMinutes ?? activeCohort?.dailyGoalMinutes,
        schedule: paused?.schedule ?? activeCohort?.schedule,
        frequency: paused?.frequency ?? activeCohort?.frequency,
        orderStyle: paused?.orderStyle ?? activeCohort?.orderStyle,
        isPaused: true,
        pausedUntil,
        pausedReason,
      },
      snapshot
    );
  }

  function resumePausedCohort(cohortId: string) {
    const snapshot = { activeCohorts, continueLater };
    const pausedCohort = continueLater.find(c => (c.cohortId || c.id) === cohortId || c.id === cohortId);
    const cleanId = pausedCohort?.cohortId || pausedCohort?.id || cohortId;
    const result = resumeCohort(activeCohorts, continueLater, cleanId);

    setActiveCohorts(result.activeCohorts);
    setContinueLater(result.continueLater);

    const resumed = result.activeCohorts.find(c => (c.cohortId || c.id) === cleanId || c.id === cleanId);
    if (resumed) {
      debouncedSyncCohort(
        cleanId,
        {
          ...resumed,
          isPaused: false,
          pausedUntil: undefined,
        },
        snapshot
      );
    }
  }

  return {
    loading: isLoading,
    isSyncing,
    syncError,
    isAuthenticated,
    ...home,
    activeCohorts,
    continueLater,
    actions: {
      moveCohort,
      pauseActiveCohort,
      resumePausedCohort,
      saveDailyGoal,
      saveSchedule,
      saveOrderStyle,
      saveFrequency,
    },
  };
}

export type UseHomeResult = ReturnType<typeof useHome>;

