import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import {
  normalizeCohortId,
  computeStateChangeOrdering,
  type CohortConfigSnapshot,
} from '../cohortOrder.service';

describe('normalizeCohortId', () => {
  it('strips only exact legacy userId prefix and preserves cohort IDs with underscores', () => {
    expect(normalizeCohortId('user123_cohort456', 'user123')).toBe('cohort456');
    expect(normalizeCohortId('ml_foundations_101', 'user123')).toBe('ml_foundations_101');
    expect(normalizeCohortId('deep_learning_v2', null)).toBe('deep_learning_v2');
    expect(normalizeCohortId('', 'user123')).toBe('');
  });
});

describe('computeStateChangeOrdering pure ordering rules', () => {
  const authorizedIds = new Set(['cohort_a', 'cohort_b', 'cohort_c', 'cohort_d']);

  it('pauses cohort A: removes from active, appends to paused, assigns contiguous 1..N ranks', () => {
    const configs: CohortConfigSnapshot[] = [
      { cohortId: 'cohort_a', rank: 1, isPaused: false },
      { cohortId: 'cohort_b', rank: 2, isPaused: false },
      { cohortId: 'cohort_c', rank: 3, isPaused: false },
      { cohortId: 'cohort_d', rank: 4, isPaused: true, pausedUntil: new Date(Date.now() + 86400000) },
    ];

    const result = computeStateChangeOrdering({
      authorizedCohortIds: authorizedIds,
      currentConfigs: configs,
      operation: 'pause',
      targetCohortId: 'cohort_a',
      pausedUntil: new Date('2026-11-15T00:00:00.000Z'),
      pausedReason: 'Vacation',
    });

    // Active cohorts are B and C
    expect(result.active.map((c) => c.cohortId)).toEqual(['cohort_b', 'cohort_c']);
    expect(result.active.map((c) => c.rank)).toEqual([1, 2]);

    // Paused cohorts are D then A (appended to end of paused)
    expect(result.paused.map((c) => c.cohortId)).toEqual(['cohort_d', 'cohort_a']);
    expect(result.paused.map((c) => c.rank)).toEqual([3, 4]);

    const targetUpdate = result.updates.find((u) => u.cohortId === 'cohort_a');
    expect(targetUpdate).toMatchObject({
      rank: 4,
      isPaused: true,
      pausedUntil: new Date('2026-11-15T00:00:00.000Z'),
      pausedReason: 'Vacation',
    });
  });

  it('resumes cohort A: removes from paused, appends to active, clears pausedUntil/reason', () => {
    const configs: CohortConfigSnapshot[] = [
      { cohortId: 'cohort_b', rank: 1, isPaused: false },
      { cohortId: 'cohort_c', rank: 2, isPaused: false },
      { cohortId: 'cohort_d', rank: 3, isPaused: true },
      { cohortId: 'cohort_a', rank: 4, isPaused: true, pausedUntil: new Date(Date.now() + 86400000), pausedReason: 'Old reason' },
    ];

    const result = computeStateChangeOrdering({
      authorizedCohortIds: authorizedIds,
      currentConfigs: configs,
      operation: 'resume',
      targetCohortId: 'cohort_a',
    });

    // Active cohorts are B, C, then A (appended to end of active)
    expect(result.active.map((c) => c.cohortId)).toEqual(['cohort_b', 'cohort_c', 'cohort_a']);
    expect(result.active.map((c) => c.rank)).toEqual([1, 2, 3]);

    // Paused cohort is D
    expect(result.paused.map((c) => c.cohortId)).toEqual(['cohort_d']);
    expect(result.paused.map((c) => c.rank)).toEqual([4]);

    const targetUpdate = result.updates.find((u) => u.cohortId === 'cohort_a');
    expect(targetUpdate).toMatchObject({
      rank: 3,
      isPaused: false,
      pausedUntil: null,
      pausedReason: '',
    });
  });

  it('treats expired pauses as active immediately during ordering calculation', () => {
    const now = new Date('2026-10-30T12:00:00.000Z');
    const expiredDate = new Date('2026-10-30T10:00:00.000Z'); // 2 hours ago

    const configs: CohortConfigSnapshot[] = [
      { cohortId: 'cohort_a', rank: 1, isPaused: false },
      { cohortId: 'cohort_b', rank: 2, isPaused: true, pausedUntil: expiredDate }, // Expired
      { cohortId: 'cohort_c', rank: 3, isPaused: false },
    ];

    const result = computeStateChangeOrdering({
      authorizedCohortIds: new Set(['cohort_a', 'cohort_b', 'cohort_c']),
      currentConfigs: configs,
      operation: 'pause',
      targetCohortId: 'cohort_a',
      now,
    });

    // Since cohort_b expired, it was active alongside cohort_c. Pausing cohort_a leaves cohort_b and cohort_c active
    expect(result.active.map((c) => c.cohortId)).toEqual(['cohort_b', 'cohort_c']);
    expect(result.paused.map((c) => c.cohortId)).toEqual(['cohort_a']);
  });
});
