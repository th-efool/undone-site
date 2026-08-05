import type { ActiveCohort, LearningSchedule, PausedCohort, Weekday } from '../models';

const orderedWeekdays: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function calculatePriority<T extends { id: string }>(
  items: T[],
): Array<T & { rank: number }> {
  return items.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

export function formatSchedule(days: Weekday[]): LearningSchedule {
  const sortedDays = orderedWeekdays.filter((day) => days.includes(day));

  return {
    days: sortedDays,
    label: sortedDays.length === orderedWeekdays.length ? 'Everyday' : sortedDays.join(', '),
  };
}

export function reorderCohorts(
  items: ActiveCohort[],
  draggedId: string,
  targetId: string,
): ActiveCohort[] {
  if (draggedId === targetId) {
    return items;
  }

  const draggedIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (draggedIndex < 0 || targetIndex < 0) {
    return items;
  }

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(draggedIndex, 1);
  nextItems.splice(targetIndex, 0, draggedItem);

  return calculatePriority(nextItems);
}

export function updateSchedule(
  items: ActiveCohort[],
  cohortId: string,
  days: Weekday[],
): ActiveCohort[] {
  const schedule = formatSchedule(days);

  return items.map((item) => (item.id === cohortId ? { ...item, schedule } : item));
}

export function updateDailyGoal(
  items: ActiveCohort[],
  cohortId: string,
  dailyGoalMinutes: number,
): ActiveCohort[] {
  const safeGoal = Math.min(180, Math.max(5, dailyGoalMinutes));

  return items.map((item) =>
    item.id === cohortId ? { ...item, dailyGoalMinutes: safeGoal } : item,
  );
}

export function updateOrderStyle(
  items: ActiveCohort[],
  cohortId: string,
  orderStyle: 'Sequential' | 'Semantic Randomize' | 'Randomize',
): ActiveCohort[] {
  return items.map((item) =>
    item.id === cohortId ? { ...item, orderStyle } : item,
  );
}

export function pauseCohort(
  activeItems: ActiveCohort[],
  pausedItems: PausedCohort[],
  cohortId: string,
  pausedUntil: Date,
  pausedReason?: string,
): { activeCohorts: ActiveCohort[]; continueLater: PausedCohort[] } {
  const cohort = activeItems.find((item) => item.id === cohortId);

  if (!cohort) {
    return { activeCohorts: activeItems, continueLater: pausedItems };
  }

  return {
    activeCohorts: calculatePriority(activeItems.filter((item) => item.id !== cohortId)),
    continueLater: [
      {
        id: cohort.id,
        title: cohort.title,
        provider: cohort.provider,
        thumbnail: cohort.thumbnail,
        minutesToday: cohort.minutesToday,
        dailyGoalMinutes: cohort.dailyGoalMinutes,
        progressPercent: cohort.progressPercent,
        schedule: cohort.schedule,
        featured: cohort.featured,
        pausedUntil: pausedUntil.toISOString(),
        pausedReason,
        resumeLabel: getResumeLabel(pausedUntil),
      },
      ...pausedItems,
    ],
  };
}

export function resumeCohort(
  activeItems: ActiveCohort[],
  pausedItems: PausedCohort[],
  cohortId: string,
): { activeCohorts: ActiveCohort[]; continueLater: PausedCohort[] } {
  const cohort = pausedItems.find((item) => item.id === cohortId);

  if (!cohort) {
    return { activeCohorts: activeItems, continueLater: pausedItems };
  }

  return {
    activeCohorts: calculatePriority([...activeItems, toActiveCohort(cohort)]),
    continueLater: pausedItems.filter((item) => item.id !== cohortId),
  };
}

export function getActiveCohorts(
  activeItems: ActiveCohort[],
  pausedItems: PausedCohort[],
  today = new Date(),
) {
  const readyToResume = pausedItems.filter((item) => today >= new Date(item.pausedUntil));
  const stillPaused = pausedItems.filter((item) => today < new Date(item.pausedUntil));

  const restored = readyToResume.map(toActiveCohort);

  return {
    activeCohorts: calculatePriority([...activeItems, ...restored]),
    continueLater: stillPaused,
  };
}

function toActiveCohort(cohort: PausedCohort): Omit<ActiveCohort, 'rank'> {
  return {
    id: cohort.id,
    title: cohort.title,
    provider: cohort.provider,
    thumbnail: cohort.thumbnail,
    minutesToday: cohort.minutesToday,
    dailyGoalMinutes: cohort.dailyGoalMinutes,
    progressPercent: cohort.progressPercent,
    schedule: cohort.schedule,
    featured: cohort.featured,
  };
}

export function getPausedCohorts(pausedItems: PausedCohort[], today = new Date()) {
  return pausedItems.filter((item) => today < new Date(item.pausedUntil));
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function getResumeLabel(date: Date, today = new Date()) {
  const differenceMs = date.getTime() - today.getTime();
  const days = Math.max(1, Math.ceil(differenceMs / (24 * 60 * 60 * 1000)));

  if (days === 1) {
    return 'Resume tomorrow';
  }

  if (days % 7 === 0 && days < 30) {
    const weeks = days / 7;
    return `Resume in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }

  if (days >= 30) {
    return 'Resume in 1 month';
  }

  return `Resume in ${days} days`;
}
