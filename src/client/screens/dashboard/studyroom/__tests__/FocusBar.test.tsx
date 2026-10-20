/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import FocusBar from '../room/components/FocusBar';
import type { PomodoroState } from '../types';
import {
  DEFAULT_POMODORO_SETTINGS,
  createInitialPomodoroState,
} from '../utils/pomodoroReducer';

function createMockPomodoroState(overrides?: Partial<PomodoroState>): PomodoroState {
  return {
    ...createInitialPomodoroState(),
    ...overrides,
  };
}

describe('FocusBar component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders time formatted as MM:SS and three phase toggle chips', () => {
    const state = createMockPomodoroState({
      remainingMs: 25 * 60 * 1000,
      phaseDurationMs: 25 * 60 * 1000,
    });

    render(
      <FocusBar
        state={state}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
        onSkip={vi.fn()}
        onSelectPhase={vi.fn()}
        onOpenSettings={vi.fn()}
        settingsOpen={false}
        announcement="Timer ready"
      />
    );

    expect(screen.getByRole('timer').textContent).toBe('25:00');

    const focusChip = screen.getByRole('button', { name: 'Focus' });
    const shortBreakChip = screen.getByRole('button', { name: 'Short break' });
    const longBreakChip = screen.getByRole('button', { name: 'Long break' });

    expect(focusChip.getAttribute('aria-pressed')).toBe('true');
    expect(shortBreakChip.getAttribute('aria-pressed')).toBe('false');
    expect(longBreakChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('handles phase selection with onSelectPhase callback', () => {
    const state = createMockPomodoroState();
    const selectPhaseSpy = vi.fn();

    render(
      <FocusBar
        state={state}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
        onSkip={vi.fn()}
        onSelectPhase={selectPhaseSpy}
        onOpenSettings={vi.fn()}
        settingsOpen={false}
        announcement=""
      />
    );

    const shortBreakChip = screen.getByRole('button', { name: 'Short break' });
    fireEvent.click(shortBreakChip);

    expect(selectPhaseSpy).toHaveBeenCalledWith('shortBreak');
  });

  it('displays Start button when idle and calls onStart on click', () => {
    const state = createMockPomodoroState({ status: 'idle' });
    const startSpy = vi.fn();

    render(
      <FocusBar
        state={state}
        onStart={startSpy}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
        onSkip={vi.fn()}
        onSelectPhase={vi.fn()}
        onOpenSettings={vi.fn()}
        settingsOpen={false}
        announcement=""
      />
    );

    const startBtn = screen.getByRole('button', { name: 'Start timer' });
    expect(startBtn.textContent).toContain('Start');

    fireEvent.click(startBtn);
    expect(startSpy).toHaveBeenCalledTimes(1);

    // Reset button should be disabled when idle
    const resetBtn = screen.getByRole('button', { name: 'Reset timer' });
    expect(resetBtn.hasAttribute('disabled')).toBe(true);
  });

  it('displays Pause button when running and calls onPause on click', () => {
    const state = createMockPomodoroState({ status: 'running' });
    const pauseSpy = vi.fn();
    const resetSpy = vi.fn();

    render(
      <FocusBar
        state={state}
        onStart={vi.fn()}
        onPause={pauseSpy}
        onResume={vi.fn()}
        onReset={resetSpy}
        onSkip={vi.fn()}
        onSelectPhase={vi.fn()}
        onOpenSettings={vi.fn()}
        settingsOpen={false}
        announcement=""
      />
    );

    const pauseBtn = screen.getByRole('button', { name: 'Pause timer' });
    expect(pauseBtn.textContent).toContain('Pause');

    fireEvent.click(pauseBtn);
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    // Reset button should be enabled when running
    const resetBtn = screen.getByRole('button', { name: 'Reset timer' });
    expect(resetBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(resetBtn);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('displays Resume button when paused and calls onResume on click', () => {
    const state = createMockPomodoroState({ status: 'paused' });
    const resumeSpy = vi.fn();

    render(
      <FocusBar
        state={state}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={resumeSpy}
        onReset={vi.fn()}
        onSkip={vi.fn()}
        onSelectPhase={vi.fn()}
        onOpenSettings={vi.fn()}
        settingsOpen={false}
        announcement=""
      />
    );

    const resumeBtn = screen.getByRole('button', { name: 'Resume timer' });
    expect(resumeBtn.textContent).toContain('Resume');

    fireEvent.click(resumeBtn);
    expect(resumeSpy).toHaveBeenCalledTimes(1);
  });

  it('handles skip phase button click', () => {
    const state = createMockPomodoroState({ status: 'running' });
    const skipSpy = vi.fn();

    render(
      <FocusBar
        state={state}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
        onSkip={skipSpy}
        onSelectPhase={vi.fn()}
        onOpenSettings={vi.fn()}
        settingsOpen={false}
        announcement=""
      />
    );

    const skipBtn = screen.getByRole('button', { name: 'Skip phase' });
    fireEvent.click(skipBtn);
    expect(skipSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenSettings with trigger element when settings button is clicked', () => {
    const state = createMockPomodoroState();
    const settingsSpy = vi.fn();

    render(
      <FocusBar
        state={state}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
        onSkip={vi.fn()}
        onSelectPhase={vi.fn()}
        onOpenSettings={settingsSpy}
        settingsOpen={true}
        announcement=""
      />
    );

    const settingsBtn = screen.getByRole('button', { name: 'Timer settings' });
    expect(settingsBtn.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(settingsBtn);
    expect(settingsSpy).toHaveBeenCalledWith(settingsBtn);
  });

  it('renders cycle dots and completed sessions counter text', () => {
    const state = createMockPomodoroState({
      completedFocusSessions: 3,
      settings: { ...DEFAULT_POMODORO_SETTINGS, longBreakEvery: 4 },
    });

    render(
      <FocusBar
        state={state}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
        onSkip={vi.fn()}
        onSelectPhase={vi.fn()}
        onOpenSettings={vi.fn()}
        settingsOpen={false}
        announcement="Focus complete"
      />
    );

    expect(screen.getByText('3 focus sessions this visit')).toBeTruthy();
    expect(screen.getByText('Focus complete')).toBeTruthy();
  });
});
