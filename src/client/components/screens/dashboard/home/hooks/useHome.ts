import { useEffect, useMemo, useState } from 'react';

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

export function useHome() {
  const [loading, setLoading] = useState(true);
  const home = useMemo(() => homeRepository.getHome(), []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Background pluggable backend sync
  useEffect(() => {
    homeStorageAdapter.syncWithBackend().catch(() => {});
  }, []);

  const initialCohorts = useMemo(
    () => getActiveCohorts(home.activeCohorts, home.continueLater),
    [home],
  );
  const [activeCohorts, setActiveCohorts] = useState(initialCohorts.activeCohorts);
  const [continueLater, setContinueLater] = useState(initialCohorts.continueLater);

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
    setActiveCohorts((items) => updateSchedule(items, cohortId, days));
  }

  function saveDailyGoal(cohortId: string, minutes: number) {
    setActiveCohorts((items) => updateDailyGoal(items, cohortId, minutes));
  }

  function saveOrderStyle(cohortId: string, style: 'Sequential' | 'Semantic Randomize' | 'Randomize') {
    setActiveCohorts((items) => updateOrderStyle(items, cohortId, style));
  }

  function saveFrequency(cohortId: string, frequency: 'Very Often' | 'Often' | 'Sometimes' | 'Rarely' | 'Very Rarely') {
    setActiveCohorts((items) => updateFrequency(items, cohortId, frequency));
  }

  function pauseActiveCohort(cohortId: string, days: number, pausedReason?: string) {
    const pausedUntil = addDays(new Date(), days);

    setActiveCohorts((currentActive) => {
      const result = pauseCohort(currentActive, continueLater, cohortId, pausedUntil, pausedReason);
      setContinueLater(result.continueLater);
      return result.activeCohorts;
    });
  }

  function resumePausedCohort(cohortId: string) {
    setContinueLater((currentPaused) => {
      const result = resumeCohort(activeCohorts, currentPaused, cohortId);
      setActiveCohorts(result.activeCohorts);
      return result.continueLater;
    });
  }

  return {
    loading,
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
