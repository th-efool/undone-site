/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  clampSetting,
  createInitialPomodoroState,
  DEFAULT_POMODORO_SETTINGS,
  pomodoroReducer,
} from '../utils/pomodoroReducer';

describe('pomodoroReducer utility', () => {
  it('initializes with default settings and idle state', () => {
    const state = createInitialPomodoroState();
    expect(state.phase).toBe('focus');
    expect(state.status).toBe('idle');
    expect(state.settings).toEqual(DEFAULT_POMODORO_SETTINGS);
    expect(state.phaseDurationMs).toBe(25 * 60 * 1000);
    expect(state.remainingMs).toBe(25 * 60 * 1000);
    expect(state.endsAt).toBeNull();
    expect(state.completedFocusSessions).toBe(0);
    expect(state.completionSeq).toBe(0);
    expect(state.lastCompletedPhase).toBeNull();
  });

  it('handles START, PAUSE, and RESUME transitions with explicit timestamps', () => {
    let state = createInitialPomodoroState();
    const t0 = 1_000_000;

    // START
    state = pomodoroReducer(state, { type: 'START', now: t0 });
    expect(state.status).toBe('running');
    expect(state.endsAt).toBe(t0 + 25 * 60 * 1000);
    expect(state.remainingMs).toBe(25 * 60 * 1000);

    // PAUSE after 5 minutes (300_000 ms)
    const t1 = t0 + 300_000;
    state = pomodoroReducer(state, { type: 'PAUSE', now: t1 });
    expect(state.status).toBe('paused');
    expect(state.endsAt).toBeNull();
    expect(state.remainingMs).toBe(20 * 60 * 1000);

    // RESUME 10 minutes later (600_000 ms pause)
    const t2 = t1 + 600_000;
    state = pomodoroReducer(state, { type: 'RESUME', now: t2 });
    expect(state.status).toBe('running');
    expect(state.endsAt).toBe(t2 + 20 * 60 * 1000);
    expect(state.remainingMs).toBe(20 * 60 * 1000);
  });

  it('increments completed sessions on natural completion and alternates to short break', () => {
    let state = createInitialPomodoroState();
    const t0 = 1_000_000;
    state = pomodoroReducer(state, { type: 'START', now: t0 });

    const completeTime = t0 + 25 * 60 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now: completeTime });

    expect(state.phase).toBe('shortBreak');
    expect(state.status).toBe('idle');
    expect(state.endsAt).toBeNull();
    expect(state.completedFocusSessions).toBe(1);
    expect(state.completionSeq).toBe(1);
    expect(state.lastCompletedPhase).toBe('focus');
    expect(state.remainingMs).toBe(5 * 60 * 1000);
  });

  it('transitions to long break after 4 completed focus sessions', () => {
    let state = createInitialPomodoroState();
    let now = 1_000_000;

    for (let i = 1; i <= 3; i++) {
      // Start & complete focus
      state = pomodoroReducer(state, { type: 'START', now });
      now += 25 * 60 * 1000;
      state = pomodoroReducer(state, { type: 'TICK', now });
      expect(state.phase).toBe('shortBreak');
      expect(state.completedFocusSessions).toBe(i);

      // Start & complete short break
      state = pomodoroReducer(state, { type: 'START', now });
      now += 5 * 60 * 1000;
      state = pomodoroReducer(state, { type: 'TICK', now });
      expect(state.phase).toBe('focus');
    }

    // 4th focus session
    state = pomodoroReducer(state, { type: 'START', now });
    now += 25 * 60 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now });

    // Must trigger long break (completed 4 % 4 === 0)
    expect(state.phase).toBe('longBreak');
    expect(state.completedFocusSessions).toBe(4);
    expect(state.remainingMs).toBe(15 * 60 * 1000);

    // Completing long break returns to focus
    state = pomodoroReducer(state, { type: 'START', now });
    now += 15 * 60 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now });
    expect(state.phase).toBe('focus');
  });

  it('tracks completedShortBreaks and completedLongBreaks on break completions and alternates properly', () => {
    let state = createInitialPomodoroState(
      { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 2 },
      { completedFocusSessions: 0, completedShortBreaks: 0, completedLongBreaks: 0 }
    );
    let now = 1_000_000;

    // 1. Focus session 1
    state = pomodoroReducer(state, { type: 'START', now });
    now += 25 * 60 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now });
    expect(state.phase).toBe('shortBreak');
    expect(state.completedFocusSessions).toBe(1);
    expect(state.completedShortBreaks).toBe(0);

    // 2. Short break 1 completes -> increments short breaks, returns to focus
    state = pomodoroReducer(state, { type: 'START', now });
    now += 5 * 60 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now });
    expect(state.phase).toBe('focus');
    expect(state.completedShortBreaks).toBe(1);

    // 3. Focus session 2 (2 % 2 === 0, longBreak triggered)
    state = pomodoroReducer(state, { type: 'START', now });
    now += 25 * 60 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now });
    expect(state.phase).toBe('longBreak');
    expect(state.completedFocusSessions).toBe(2);

    // 4. Long break completes -> increments long breaks, returns to focus
    state = pomodoroReducer(state, { type: 'START', now });
    now += 15 * 60 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now });
    expect(state.phase).toBe('focus');
    expect(state.completedLongBreaks).toBe(1);
  });

  it('respects autoStartNext setting on completion', () => {
    let state = createInitialPomodoroState({ autoStartNext: true });
    const t0 = 1_000_000;
    state = pomodoroReducer(state, { type: 'START', now: t0 });

    const finishTime = t0 + 25 * 60 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now: finishTime });

    expect(state.phase).toBe('shortBreak');
    expect(state.status).toBe('running');
    expect(state.endsAt).toBe(finishTime + 5 * 60 * 1000);
    expect(state.remainingMs).toBe(5 * 60 * 1000);
  });

  it('RESET preserves current phase and completed count, resetting countdown to current settings', () => {
    let state = createInitialPomodoroState();
    const t0 = 1_000_000;
    state = pomodoroReducer(state, { type: 'START', now: t0 });
    state = pomodoroReducer(state, { type: 'TICK', now: t0 + 10_000 });

    state = pomodoroReducer(state, { type: 'RESET' });
    expect(state.status).toBe('idle');
    expect(state.phase).toBe('focus');
    expect(state.remainingMs).toBe(25 * 60 * 1000);
    expect(state.endsAt).toBeNull();
    expect(state.completedFocusSessions).toBe(0);
  });

  it('SKIP advances phase without incrementing completed sessions', () => {
    let state = createInitialPomodoroState();
    const t0 = 1_000_000;
    state = pomodoroReducer(state, { type: 'START', now: t0 });

    state = pomodoroReducer(state, { type: 'SKIP' });
    expect(state.phase).toBe('shortBreak');
    expect(state.status).toBe('idle');
    expect(state.completedFocusSessions).toBe(0);

    state = pomodoroReducer(state, { type: 'SKIP' });
    expect(state.phase).toBe('focus');
    expect(state.status).toBe('idle');
  });

  it('SELECT_PHASE resets timer for the selected phase and discards running progress', () => {
    let state = createInitialPomodoroState();
    const t0 = 1_000_000;
    state = pomodoroReducer(state, { type: 'START', now: t0 });

    state = pomodoroReducer(state, { type: 'SELECT_PHASE', phase: 'longBreak' });
    expect(state.phase).toBe('longBreak');
    expect(state.status).toBe('idle');
    expect(state.remainingMs).toBe(15 * 60 * 1000);
    expect(state.endsAt).toBeNull();
  });

  it('updates durations immediately when idle, but defers when running or paused', () => {
    let state = createInitialPomodoroState();

    // Idle update: updates duration immediately
    state = pomodoroReducer(state, {
      type: 'UPDATE_SETTINGS',
      patch: { focusMinutes: 50 },
    });
    expect(state.settings.focusMinutes).toBe(50);
    expect(state.phaseDurationMs).toBe(50 * 60 * 1000);
    expect(state.remainingMs).toBe(50 * 60 * 1000);

    // Running update: preserves running countdown
    const t0 = 1_000_000;
    state = pomodoroReducer(state, { type: 'START', now: t0 });
    state = pomodoroReducer(state, {
      type: 'UPDATE_SETTINGS',
      patch: { focusMinutes: 20 },
    });
    expect(state.settings.focusMinutes).toBe(20);
    expect(state.remainingMs).toBe(50 * 60 * 1000); // Running countdown preserved
    expect(state.endsAt).toBe(t0 + 50 * 60 * 1000);

    // Reset applies the new setting
    state = pomodoroReducer(state, { type: 'RESET' });
    expect(state.remainingMs).toBe(20 * 60 * 1000);
  });

  it('validates and clamps settings correctly', () => {
    expect(clampSetting('focusMinutes', 150)).toBe(120);
    expect(clampSetting('focusMinutes', 0)).toBe(1);
    expect(clampSetting('focusMinutes', '35')).toBe(35);
    expect(clampSetting('focusMinutes', NaN)).toBeNull();
    expect(clampSetting('focusMinutes', 'invalid')).toBeNull();
    expect(clampSetting('shortBreakMinutes', 45)).toBe(30);
    expect(clampSetting('longBreakEvery', 1)).toBe(2);
    expect(clampSetting('autoStartNext', true)).toBe(true);
    expect(clampSetting('autoStartNext', 'true')).toBeNull();
  });

  it('produces exactly one transition even when TICK timestamp is far past endsAt', () => {
    let state = createInitialPomodoroState();
    const t0 = 1_000_000;
    state = pomodoroReducer(state, { type: 'START', now: t0 });

    // Tick 5 hours in the future
    const fiveHoursLater = t0 + 5 * 3600 * 1000;
    state = pomodoroReducer(state, { type: 'TICK', now: fiveHoursLater });

    // Exactly one transition: focus -> shortBreak, completionSeq === 1, not multiple cascades
    expect(state.phase).toBe('shortBreak');
    expect(state.completedFocusSessions).toBe(1);
    expect(state.completionSeq).toBe(1);
    expect(state.status).toBe('idle');
  });
});
