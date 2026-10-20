/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePomodoro } from '../hooks/usePomodoro';
import * as chimeModule from '../utils/chime';

vi.mock('../utils/chime', () => ({
  playChime: vi.fn(),
}));

describe('usePomodoro hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    document.title = 'Initial Title';
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes in idle status with default durations', () => {
    const { result } = renderHook(() => usePomodoro('Library'));

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.phase).toBe('focus');
    expect(result.current.state.phaseDurationMs).toBe(25 * 60_000);
    expect(result.current.state.remainingMs).toBe(25 * 60_000);
    expect(result.current.state.completedFocusSessions).toBe(0);
    expect(result.current.announcement).toBe('');
    expect(document.title).toBe('Initial Title');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts running, ticks down, and updates document.title', () => {
    const { result, unmount } = renderHook(() => usePomodoro('Library'));

    act(() => {
      result.current.start();
    });

    expect(result.current.state.status).toBe('running');
    expect(document.title).toBe('25:00 · Focus — Library');
    // Exactly 1 timer active (250 ms tick interval)
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.state.remainingMs).toBe(25 * 60_000 - 1000);
    expect(document.title).toBe('24:59 · Focus — Library');

    unmount();
    // Verify interval is cleared on unmount with 0 leaked timers
    expect(vi.getTimerCount()).toBe(0);
    // Verify document title is restored on unmount
    expect(document.title).toBe('Initial Title');
  });

  it('pauses and resumes countdown without leaking timers', () => {
    const { result } = renderHook(() => usePomodoro('Library'));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const remainingBeforePause = result.current.state.remainingMs;

    act(() => {
      result.current.pause();
    });

    expect(result.current.state.status).toBe('paused');
    // Timer interval must be cleared while paused
    expect(vi.getTimerCount()).toBe(0);

    // Advancing time while paused should NOT decrease remainingMs
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.state.remainingMs).toBe(remainingBeforePause);

    // Resume
    act(() => {
      result.current.resume();
    });

    expect(result.current.state.status).toBe('running');
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.state.remainingMs).toBe(remainingBeforePause - 1000);
  });

  it('resets timer, restores document title, and clears timers', () => {
    const { result } = renderHook(() => usePomodoro('Library'));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(document.title).toContain('Focus — Library');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.remainingMs).toBe(25 * 60_000);
    expect(document.title).toBe('Initial Title');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips phase without counting completed sessions', () => {
    const { result } = renderHook(() => usePomodoro('Library'));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.skip();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.phase).toBe('shortBreak');
    expect(result.current.state.completedFocusSessions).toBe(0);
    expect(result.current.state.remainingMs).toBe(5 * 60_000);

    act(() => {
      result.current.skip();
    });

    expect(result.current.state.phase).toBe('focus');
    expect(result.current.state.completedFocusSessions).toBe(0);
  });

  it('selects phase and resets countdown to that phase duration', () => {
    const { result } = renderHook(() => usePomodoro('Library'));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.selectPhase('longBreak');
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.phase).toBe('longBreak');
    expect(result.current.state.phaseDurationMs).toBe(15 * 60_000);
    expect(result.current.state.remainingMs).toBe(15 * 60_000);
  });

  it('completes focus session: increments count, advances to short break, plays chime and announces', () => {
    const { result } = renderHook(() =>
      usePomodoro('Library', { focusMinutes: 1, shortBreakMinutes: 1 })
    );

    act(() => {
      result.current.start();
    });

    expect(chimeModule.playChime).not.toHaveBeenCalled();

    // Advance 60 seconds to complete
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.state.completedFocusSessions).toBe(1);
    expect(result.current.state.phase).toBe('shortBreak');
    expect(result.current.state.status).toBe('idle');
    expect(chimeModule.playChime).toHaveBeenCalledTimes(1);
    expect(result.current.announcement).toBe(
      'Focus session complete. Time for a short break.'
    );
  });

  it('completes 4th focus session: advances to long break with matching announcement', () => {
    const { result } = renderHook(() =>
      usePomodoro('Library', {
        focusMinutes: 1,
        shortBreakMinutes: 1,
        longBreakMinutes: 5,
        longBreakEvery: 4,
        autoStartNext: true,
      })
    );

    act(() => {
      result.current.start();
    });

    // Complete 3 focus sessions and 3 short breaks
    for (let i = 1; i <= 3; i++) {
      act(() => {
        vi.advanceTimersByTime(60_000); // Complete focus
      });
      expect(result.current.state.completedFocusSessions).toBe(i);
      expect(result.current.state.phase).toBe('shortBreak');

      act(() => {
        vi.advanceTimersByTime(60_000); // Complete short break (auto-starts next focus)
      });
      expect(result.current.state.phase).toBe('focus');
    }

    // Now complete 4th focus session
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.state.completedFocusSessions).toBe(4);
    expect(result.current.state.phase).toBe('longBreak');
    expect(result.current.announcement).toBe(
      'Focus session complete. Time for a long break.'
    );

    // Complete long break
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    expect(result.current.state.phase).toBe('focus');
    expect(result.current.announcement).toBe('Break over. Ready to focus?');
  });

  it('does not play chime when chimeEnabled is false', () => {
    const { result } = renderHook(() =>
      usePomodoro('Library', {
        focusMinutes: 1,
        chimeEnabled: false,
      })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(chimeModule.playChime).not.toHaveBeenCalled();
    expect(result.current.announcement).toBe(
      'Focus session complete. Time for a short break.'
    );
  });

  it('updates settings and restores defaults', () => {
    const { result } = renderHook(() => usePomodoro('Library'));

    act(() => {
      result.current.updateSettings({ focusMinutes: 50, shortBreakMinutes: 10 });
    });

    expect(result.current.state.settings.focusMinutes).toBe(50);
    expect(result.current.state.settings.shortBreakMinutes).toBe(10);
    expect(result.current.state.remainingMs).toBe(50 * 60_000);

    act(() => {
      result.current.restoreDefaults();
    });

    expect(result.current.state.settings.focusMinutes).toBe(25);
    expect(result.current.state.settings.shortBreakMinutes).toBe(5);
    expect(result.current.state.remainingMs).toBe(25 * 60_000);
  });
});
