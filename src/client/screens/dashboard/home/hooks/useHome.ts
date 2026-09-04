import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { homeRepository } from '@/src/client/repositories/homeRepository';
import { homeStorageAdapter } from '@/src/client/repositories/homeStorageAdapter';
import type { Weekday } from '../models';
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

export function useHome(props?: { 
  activeCohorts?: import('../models').ActiveCohort[];
  continueLater?: import('../models').PausedCohort[];
  recentlyCompleted?: import('../models').CompletedCourse[];
}) {
  const { data: homeData, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: async () => homeRepository.getHome(),
  });

  const home = homeData ?? homeRepository.getHome();
  
  if (props?.activeCohorts) home.activeCohorts = props.activeCohorts;
  if (props?.continueLater) home.continueLater = props.continueLater;
  if (props?.recentlyCompleted) home.recentlyCompleted = props.recentlyCompleted;

  // Background pluggable backend sync
  useEffect(() => {
    homeStorageAdapter.syncWithBackend().catch(() => {});
  }, []);

  const initialCohorts = useMemo(
    () => getActiveCohorts(home.activeCohorts, home.continueLater),
    [home.activeCohorts, home.continueLater],
  );
  const [activeCohorts, setActiveCohorts] = useState(initialCohorts.activeCohorts);
  const [continueLater, setContinueLater] = useState(initialCohorts.continueLater);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function debouncedSyncCohort(
    cohortId: string,
    config: Partial<import('../models').ActiveCohort> & {
      isPaused?: boolean;
      pausedUntil?: string | Date;
      pausedReason?: string;
    }
  ) {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      fetch('/api/user/cohort-config', {
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
      }).catch(() => {}); // best-effort, no error throwing
    }, 1500);
  }

  // Sync state if server props change
  useEffect(() => {
    if (props?.activeCohorts) setActiveCohorts(props.activeCohorts);
    if (props?.continueLater) setContinueLater(props.continueLater);
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
    setActiveCohorts((items) => reorderCohorts(items, draggedId, targetId));
  }

  function saveSchedule(cohortId: string, days: Weekday[]) {
    setActiveCohorts((items) => {
      const updated = updateSchedule(items, cohortId, days);
      const cohort = updated.find(c => c.id === cohortId);
      if (cohort) debouncedSyncCohort(cohortId, cohort);
      return updated;
    });
  }

  function saveDailyGoal(cohortId: string, minutes: number) {
    setActiveCohorts((items) => {
      const updated = updateDailyGoal(items, cohortId, minutes);
      const cohort = updated.find(c => c.id === cohortId);
      if (cohort) debouncedSyncCohort(cohortId, cohort);
      return updated;
    });
  }

  function saveOrderStyle(cohortId: string, style: 'Sequential' | 'Semantic Randomize' | 'Randomize') {
    setActiveCohorts((items) => {
      const updated = updateOrderStyle(items, cohortId, style);
      const cohort = updated.find(c => c.id === cohortId);
      if (cohort) debouncedSyncCohort(cohortId, cohort);
      return updated;
    });
  }

  function saveFrequency(cohortId: string, frequency: 'Very Often' | 'Often' | 'Sometimes' | 'Rarely' | 'Very Rarely') {
    setActiveCohorts((items) => {
      const updated = updateFrequency(items, cohortId, frequency);
      const cohort = updated.find(c => c.id === cohortId);
      if (cohort) debouncedSyncCohort(cohortId, cohort);
      return updated;
    });
  }

  function pauseActiveCohort(cohortId: string, days: number, pausedReason?: string) {
    const pausedUntil = addDays(new Date(), days);

    setActiveCohorts((currentActive) => {
      const activeCohort = currentActive.find((c) => c.id === cohortId);
      const result = pauseCohort(currentActive, continueLater, cohortId, pausedUntil, pausedReason);
      setContinueLater(result.continueLater);
      const paused = result.continueLater.find((c) => c.id === cohortId);
      debouncedSyncCohort(cohortId, {
        rank: activeCohort?.rank,
        dailyGoalMinutes: paused?.dailyGoalMinutes,
        schedule: paused?.schedule,
        frequency: paused?.frequency,
        orderStyle: paused?.orderStyle,
        isPaused: true,
        pausedUntil,
        pausedReason,
      });
      return result.activeCohorts;
    });
  }

  function resumePausedCohort(cohortId: string) {
    setContinueLater((currentPaused) => {
      const result = resumeCohort(activeCohorts, currentPaused, cohortId);
      setActiveCohorts(result.activeCohorts);
      const resumed = result.activeCohorts.find(c => c.id === cohortId);
      if (resumed) {
        debouncedSyncCohort(cohortId, {
          ...resumed,
          isPaused: false,
          pausedUntil: undefined,
        });
      }
      return result.continueLater;
    });
  }

  return {
    loading: isLoading,
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

