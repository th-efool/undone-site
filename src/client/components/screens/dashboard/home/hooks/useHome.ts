import { useEffect, useMemo, useState } from 'react';

import { homeRepository } from '@/src/client/repositories/homeRepository';
import type { Weekday } from '../models';
import {
  addDays,
  getActiveCohorts,
  pauseCohort,
  reorderCohorts,
  resumeCohort,
  updateDailyGoal,
  updateSchedule,
} from '../utils';

export function useHome() {
  const [loading, setLoading] = useState(true);
  const home = useMemo(() => homeRepository.getHome(), []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);
  const initialCohorts = useMemo(
    () => getActiveCohorts(home.activeCohorts, home.continueLater),
    [home],
  );
  const [activeCohorts, setActiveCohorts] = useState(initialCohorts.activeCohorts);
  const [continueLater, setContinueLater] = useState(initialCohorts.continueLater);

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
    },
  };
}
