import { describe, expect, it } from 'vitest';
import { pauseCohort, resumeCohort } from '../cohortManagement';
import type { ActiveCohort, PausedCohort } from '../../models';

const active1: ActiveCohort = {
  id: 'c1',
  rank: 1,
  title: 'Active One',
  provider: 'Undone',
  thumbnail: '/cover1.jpg',
  minutesToday: 0,
  dailyGoalMinutes: 20,
  progressPercent: 10,
  schedule: { days: ['Mon'], label: 'Mon' },
};

const active2: ActiveCohort = {
  id: 'c2',
  rank: 2,
  title: 'Active Two',
  provider: 'Undone',
  thumbnail: '/cover2.jpg',
  minutesToday: 0,
  dailyGoalMinutes: 20,
  progressPercent: 20,
  schedule: { days: ['Mon'], label: 'Mon' },
};

const active3: ActiveCohort = {
  id: 'c3',
  rank: 3,
  title: 'Active Three',
  provider: 'Undone',
  thumbnail: '/cover3.jpg',
  minutesToday: 0,
  dailyGoalMinutes: 20,
  progressPercent: 30,
  schedule: { days: ['Mon'], label: 'Mon' },
};

describe('cohortManagement rearrangement on pause and resume', () => {
  it('pushes a paused cohort to far behind all active cohorts and re-indexes remaining active cohorts', () => {
    // Pausing c1 (which was rank 1)
    const result = pauseCohort([active1, active2, active3], [], 'c1');

    // Remaining active should be c2 (rank 1) and c3 (rank 2)
    expect(result.activeCohorts.map((c) => ({ id: c.id, rank: c.rank }))).toEqual([
      { id: 'c2', rank: 1 },
      { id: 'c3', rank: 2 },
    ]);

    // Paused cohort c1 should be pushed to far behind (rank 3)
    expect(result.continueLater.map((c) => ({ id: c.id, rank: c.rank }))).toEqual([
      { id: 'c1', rank: 3 },
    ]);
  });

  it('appends multiple paused cohorts at the far end behind active cohorts', () => {
    // Start with 1 active and 1 already paused
    const existingPaused: PausedCohort = {
      ...active3,
      rank: 2,
      isPaused: true,
      pausedUntil: '',
      resumeLabel: 'Paused',
    };

    // Pause active1 (c1)
    const result = pauseCohort([active1, active2], [existingPaused], 'c1');

    // Remaining active: active2 (c2, rank 1)
    expect(result.activeCohorts.map((c) => ({ id: c.id, rank: c.rank }))).toEqual([
      { id: 'c2', rank: 1 },
    ]);

    // Paused cohorts: existingPaused (c3, rank 2), newly paused active1 (c1, rank 3)
    expect(result.continueLater.map((c) => ({ id: c.id, rank: c.rank }))).toEqual([
      { id: 'c3', rank: 2 },
      { id: 'c1', rank: 3 },
    ]);
  });

  it('places a resumed cohort at the end of active cohorts in front of all paused cohorts', () => {
    const paused1: PausedCohort = {
      ...active2,
      rank: 2,
      isPaused: true,
      pausedUntil: '',
      resumeLabel: 'Paused',
    };
    const paused2: PausedCohort = {
      ...active3,
      rank: 3,
      isPaused: true,
      pausedUntil: '',
      resumeLabel: 'Paused',
    };

    // Resume paused1 (c2)
    const result = resumeCohort([active1], [paused1, paused2], 'c2');

    // Active cohorts: active1 (rank 1), resumed c2 (rank 2)
    expect(result.activeCohorts.map((c) => ({ id: c.id, rank: c.rank }))).toEqual([
      { id: 'c1', rank: 1 },
      { id: 'c2', rank: 2 },
    ]);

    // Paused cohorts remain behind: paused2 (c3, rank 3)
    expect(result.continueLater.map((c) => ({ id: c.id, rank: c.rank }))).toEqual([
      { id: 'c3', rank: 3 },
    ]);
  });
});
