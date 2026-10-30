import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { homeRepository } from '@/src/client/repositories/homeRepository';
import { homeStorageAdapter } from '@/src/client/repositories/homeStorageAdapter';
import type { ActiveCohort, PausedCohort, CompletedCourse } from '../models';
import type { CohortLearningSettings } from '../components/ActiveCohorts/ActiveCohorts';
import {
  getActiveCohorts,
  pauseCohort,
  resumeCohort,
} from '../utils';

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
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
  const userId = session?.user?.id ?? null;
  const router = useSafeRouter();

  const { data: homeData, isLoading } = useQuery({
    queryKey: ['home', userId ?? 'anon'],
    queryFn: async () => homeRepository.getHome({ loadStored: true, userId }),
    initialData: () => homeRepository.getHome({ loadStored: typeof window !== 'undefined', userId }),
    staleTime: 300_000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const source = homeData ?? homeRepository.getHome({ userId });
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
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      const stored = homeStorageAdapter.getStoredChoices(userId);
      if (stored && (Array.isArray(stored.activeCohorts) || Array.isArray(stored.continueLater))) {
        return getActiveCohorts(stored.activeCohorts ?? [], stored.continueLater ?? []);
      }
    }
    return getActiveCohorts(home.activeCohorts, home.continueLater);
  }, [props?.activeCohorts, props?.continueLater, home.activeCohorts, home.continueLater, userId]);

  const [cohortsState, setCohortsState] = useState<{
    activeCohorts: ActiveCohort[];
    continueLater: PausedCohort[];
  }>(initialCohorts);

  const activeCohorts = cohortsState.activeCohorts;
  const continueLater = cohortsState.continueLater;

  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Synchronous mutation guard
  const mutationPendingRef = useRef(false);
  const userGenerationRef = useRef(0);
  const prevUserIdRef = useRef(userId);

  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      userGenerationRef.current += 1;
      mutationPendingRef.current = false;
      setIsSyncing(false);
    }
  }, [userId]);

  const runHomeMutation = useCallback(
    async (operation: () => Promise<void>) => {
      if (mutationPendingRef.current) {
        throw new Error('A change is still saving. Please wait.');
      }
      mutationPendingRef.current = true;
      setIsSyncing(true);
      const currentGen = userGenerationRef.current;
      const currentUid = userId;

      try {
        await operation();
      } finally {
        if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
          mutationPendingRef.current = false;
          setIsSyncing(false);
        }
      }
    },
    [userId]
  );

  // Sync state if non-empty server props change, unless a mutation is actively saving
  useEffect(() => {
    if (mutationPendingRef.current) return;
    if (props?.activeCohorts !== undefined || props?.continueLater !== undefined) {
      const normalized = getActiveCohorts(props.activeCohorts ?? [], props.continueLater ?? []);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCohortsState(normalized);
    }
  }, [props?.activeCohorts, props?.continueLater]);

  // Background pluggable backend sync
  useEffect(() => {
    const hasServerCohorts =
      props?.activeCohorts !== undefined || props?.continueLater !== undefined;

    // Only perform remote backend sync if authenticated to prevent 401 console spam
    if (isAuthenticated && !hasServerCohorts) {
      homeStorageAdapter
        .syncWithBackend(true, userId)
        .then((synced) => {
          if (mutationPendingRef.current) return;
          if (synced?.activeCohorts || synced?.continueLater) {
            setCohortsState((prev) => ({
              activeCohorts: synced.activeCohorts ?? prev.activeCohorts,
              continueLater: synced.continueLater ?? prev.continueLater,
            }));
          }
        })
        .catch(() => {});
    }
  }, [props?.activeCohorts, props?.continueLater, isAuthenticated, userId]);

  // Persist user choices to local storage (only under current user identity)
  useEffect(() => {
    homeStorageAdapter.saveChoices(activeCohorts, continueLater, userId);
  }, [activeCohorts, continueLater, userId]);

  // Pause expiry timer
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCohortsState(normalized);
      return;
    }

    const validExpiries = continueLater
      .map((cohort) => cohort.pausedUntil ? new Date(cohort.pausedUntil).getTime() : NaN)
      .filter((time) => Number.isFinite(time) && time > now);
    if (!validExpiries.length) return;
    const expiry = Math.min(...validExpiries);
    const timer = setTimeout(() => {
      const normalized = getActiveCohorts(activeCohorts, continueLater);
      setCohortsState(normalized);
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

  const pauseActiveCohort = useCallback(
    async (cohortId: string, pausedUntil?: Date, pausedReason?: string) => {
      return runHomeMutation(async () => {
        if (!isAuthenticated) throw new Error('Sign in to pause a cohort');
        if (pausedUntil && (!Number.isFinite(pausedUntil.getTime()) || pausedUntil <= new Date())) {
          throw new Error('Choose a future pause date');
        }
        const activeCohort = cohortsState.activeCohorts.find((c) => (c.cohortId || c.id) === cohortId || c.id === cohortId);
        if (!activeCohort) throw new Error('Cohort not found');
        const cleanId = activeCohort?.cohortId || activeCohort?.id || cohortId;

        // 1. Optimistic snapshot & immediate state update
        const rollbackSnapshot = { ...cohortsState };
        const result = pauseCohort(cohortsState.activeCohorts, cohortsState.continueLater, cleanId, pausedUntil, pausedReason);
        setCohortsState(result);
        homeStorageAdapter.saveChoices(result.activeCohorts, result.continueLater, userId);

        const currentGen = userGenerationRef.current;
        const currentUid = userId;

        // 2. Background sync
        try {
          const response = await syncWithRetry('/api/user/cohort-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation: 'pause',
              cohortId: cleanId,
              rank: activeCohort.rank,
              isPaused: true,
              pausedUntil: pausedUntil ? pausedUntil.toISOString() : null,
              pausedReason,
            }),
          });
          if (!response.ok) {
            throw new Error(`Could not save cohort pause: HTTP ${response.status}`);
          }
          if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
            setSyncError(null);
            router?.refresh();
          }
        } catch (err) {
          if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
            setCohortsState(rollbackSnapshot);
            homeStorageAdapter.saveChoices(rollbackSnapshot.activeCohorts, rollbackSnapshot.continueLater, userId);
            setSyncError('Could not save cohort pause. Reverted.');
          }
          throw err;
        }
      });
    },
    [isAuthenticated, cohortsState, userId, runHomeMutation, router]
  );

  const resumePausedCohort = useCallback(
    async (cohortId: string) => {
      return runHomeMutation(async () => {
        if (!isAuthenticated) throw new Error('Sign in to resume a cohort');
        const pausedCohort = cohortsState.continueLater.find(c => (c.cohortId || c.id) === cohortId || c.id === cohortId);
        if (!pausedCohort) throw new Error('Cohort not found');
        const cleanId = pausedCohort?.cohortId || pausedCohort?.id || cohortId;

        // 1. Optimistic snapshot & immediate state update
        const rollbackSnapshot = { ...cohortsState };
        const result = resumeCohort(cohortsState.activeCohorts, cohortsState.continueLater, cleanId);
        setCohortsState(result);
        homeStorageAdapter.saveChoices(result.activeCohorts, result.continueLater, userId);

        const currentGen = userGenerationRef.current;
        const currentUid = userId;

        // 2. Background sync
        try {
          const response = await syncWithRetry('/api/user/cohort-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation: 'resume', cohortId: cleanId, isPaused: false, pausedUntil: null }),
          });
          if (!response.ok) {
            throw new Error(`Could not save cohort resume: HTTP ${response.status}`);
          }
          if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
            setSyncError(null);
            router?.refresh();
          }
        } catch (err) {
          if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
            setCohortsState(rollbackSnapshot);
            homeStorageAdapter.saveChoices(rollbackSnapshot.activeCohorts, rollbackSnapshot.continueLater, userId);
            setSyncError('Could not save cohort resume. Reverted.');
          }
          throw err;
        }
      });
    },
    [isAuthenticated, cohortsState, userId, runHomeMutation, router]
  );

  const saveLearningSettings = useCallback(
    async (cohortId: string, settings: CohortLearningSettings) => {
      return runHomeMutation(async () => {
        if (!isAuthenticated) throw new Error('Sign in to save learning settings');
        if (settings.dailyGoalMinutes < 5 || settings.dailyGoalMinutes > 180 || !settings.schedule.days.length) {
          throw new Error('Invalid learning settings');
        }
        const apply = <T extends ActiveCohort | PausedCohort>(cohort: T): T =>
          (cohort.cohortId || cohort.id) === cohortId ? { ...cohort, ...settings } : cohort;

        // 1. Optimistic snapshot & immediate state update
        const rollbackSnapshot = { ...cohortsState };
        const nextActive = cohortsState.activeCohorts.map(apply);
        const nextContinue = cohortsState.continueLater.map(apply);
        setCohortsState({ activeCohorts: nextActive, continueLater: nextContinue });
        homeStorageAdapter.saveChoices(nextActive, nextContinue, userId);

        const currentGen = userGenerationRef.current;
        const currentUid = userId;

        // 2. Background sync
        try {
          const response = await syncWithRetry('/api/user/cohort-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cohortId,
              dailyGoalMinutes: settings.dailyGoalMinutes,
              scheduleDays: settings.schedule.days,
              scheduleLabel: settings.schedule.label,
              orderStyle: settings.orderStyle,
            }),
          });
          if (!response.ok) throw new Error(`Could not save learning settings: HTTP ${response.status}`);
          if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
            setSyncError(null);
            router?.refresh();
          }
        } catch (err) {
          if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
            setCohortsState(rollbackSnapshot);
            homeStorageAdapter.saveChoices(rollbackSnapshot.activeCohorts, rollbackSnapshot.continueLater, userId);
            setSyncError('Could not save learning settings. Reverted.');
          }
          throw err;
        }
      });
    },
    [isAuthenticated, cohortsState, userId, runHomeMutation, router]
  );

  const removeSubscribedCohort = useCallback(
    async (cohortId: string) => {
      return runHomeMutation(async () => {
        if (!isAuthenticated) throw new Error('Sign in to remove a subscription');

        // 1. Optimistic snapshot & immediate state update
        const rollbackSnapshot = { ...cohortsState };
        const nextActive = cohortsState.activeCohorts.filter((cohort) => (cohort.cohortId || cohort.id) !== cohortId);
        const nextContinue = cohortsState.continueLater.filter((cohort) => (cohort.cohortId || cohort.id) !== cohortId);
        setCohortsState({ activeCohorts: nextActive, continueLater: nextContinue });
        homeStorageAdapter.saveChoices(nextActive, nextContinue, userId);

        const currentGen = userGenerationRef.current;
        const currentUid = userId;

        // 2. Background sync
        try {
          const response = await syncWithRetry('/api/cohort/' + encodeURIComponent(cohortId) + '/join', { method: 'DELETE' });
          if (!response.ok) throw new Error(`Could not remove subscription: HTTP ${response.status}`);
          if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
            setSyncError(null);
            router?.refresh();
          }
        } catch (err) {
          if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) {
            setCohortsState(rollbackSnapshot);
            homeStorageAdapter.saveChoices(rollbackSnapshot.activeCohorts, rollbackSnapshot.continueLater, userId);
            setSyncError('Could not remove subscription. Reverted.');
          }
          throw err;
        }
      });
    },
    [isAuthenticated, cohortsState, userId, runHomeMutation, router]
  );

  return {
    loading: isLoading,
    isSyncing,
    mutationPending: isSyncing,
    syncError,
    isAuthenticated,
    ...home,
    summaries,
    activeCohorts,
    continueLater,
    actions: {
      pauseActiveCohort,
      resumePausedCohort,
      saveLearningSettings,
      removeSubscribedCohort,
    },
  };
}

export type UseHomeResult = ReturnType<typeof useHome>;
