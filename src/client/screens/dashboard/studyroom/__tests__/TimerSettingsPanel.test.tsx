/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import TimerSettingsPanel from '../room/components/TimerSettingsPanel';
import { DEFAULT_POMODORO_SETTINGS } from '../utils/pomodoroReducer';

describe('TimerSettingsPanel component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders initial settings inputs with default values', () => {
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="idle"
        phaseDurationMs={25 * 60 * 1000}
        onChange={vi.fn()}
        onRestoreDefaults={vi.fn()}
      />
    );

    const focusInput = screen.getByLabelText('Focus (min)') as HTMLInputElement;
    const shortBreakInput = screen.getByLabelText('Short break (min)') as HTMLInputElement;
    const longBreakInput = screen.getByLabelText('Long break (min)') as HTMLInputElement;
    const intervalInput = screen.getByLabelText('Long break every (sessions)') as HTMLInputElement;

    expect(focusInput.value).toBe('25');
    expect(shortBreakInput.value).toBe('5');
    expect(longBreakInput.value).toBe('15');
    expect(intervalInput.value).toBe('4');

    expect(screen.queryByText(/New durations apply the next time a phase starts/)).toBeNull();
  });

  it('shows active hint when status is running or paused', () => {
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="running"
        phaseDurationMs={25 * 60 * 1000}
        onChange={vi.fn()}
        onRestoreDefaults={vi.fn()}
      />
    );

    expect(
      screen.getByText('New durations apply the next time a phase starts or after Reset.')
    ).toBeTruthy();
  });

  it('commits valid duration on blur and calls onChange', () => {
    const onChangeSpy = vi.fn();
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="idle"
        phaseDurationMs={25 * 60 * 1000}
        onChange={onChangeSpy}
        onRestoreDefaults={vi.fn()}
      />
    );

    const focusInput = screen.getByLabelText('Focus (min)') as HTMLInputElement;
    fireEvent.change(focusInput, { target: { value: '45' } });
    fireEvent.blur(focusInput);

    expect(onChangeSpy).toHaveBeenCalledWith({ focusMinutes: 45 });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clamps out-of-range value and shows alert message', () => {
    const onChangeSpy = vi.fn();
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="idle"
        phaseDurationMs={25 * 60 * 1000}
        onChange={onChangeSpy}
        onRestoreDefaults={vi.fn()}
      />
    );

    const shortBreakInput = screen.getByLabelText('Short break (min)') as HTMLInputElement;
    fireEvent.change(shortBreakInput, { target: { value: '999' } });
    fireEvent.blur(shortBreakInput);

    expect(onChangeSpy).toHaveBeenCalledWith({ shortBreakMinutes: 30 });
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number from 1 to 30.');
    expect(shortBreakInput.value).toBe('30');
  });

  it('reverts invalid non-numeric input on blur and shows alert', () => {
    const onChangeSpy = vi.fn();
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="idle"
        phaseDurationMs={25 * 60 * 1000}
        onChange={onChangeSpy}
        onRestoreDefaults={vi.fn()}
      />
    );

    const focusInput = screen.getByLabelText('Focus (min)') as HTMLInputElement;
    fireEvent.change(focusInput, { target: { value: '' } });
    fireEvent.blur(focusInput);

    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number from 1 to 120.');
    expect(focusInput.value).toBe('25');
  });

  it('toggles behavior checkboxes immediately', () => {
    const onChangeSpy = vi.fn();
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="idle"
        phaseDurationMs={25 * 60 * 1000}
        onChange={onChangeSpy}
        onRestoreDefaults={vi.fn()}
      />
    );

    const autoStartCheckbox = screen.getByLabelText(/Start next phase automatically/);
    fireEvent.click(autoStartCheckbox);
    expect(onChangeSpy).toHaveBeenCalledWith({ autoStartNext: true });

    const chimeCheckbox = screen.getByLabelText(/Play sound when a phase ends/);
    fireEvent.click(chimeCheckbox);
    expect(onChangeSpy).toHaveBeenCalledWith({ chimeEnabled: false });
  });

  it('restores default settings on Restore defaults click', () => {
    const restoreSpy = vi.fn();
    render(
      <TimerSettingsPanel
        settings={{
          focusMinutes: 50,
          shortBreakMinutes: 10,
          longBreakMinutes: 30,
          longBreakEvery: 2,
          autoStartNext: true,
          chimeEnabled: false,
        }}
        status="idle"
        phaseDurationMs={50 * 60 * 1000}
        onChange={vi.fn()}
        onRestoreDefaults={restoreSpy}
      />
    );

    const restoreBtn = screen.getByRole('button', { name: 'Restore defaults' });
    fireEvent.click(restoreBtn);

    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Focus (min)') as HTMLInputElement).value).toBe('25');
  });

  it('renders range sliders with required accessible names and handles slider interaction', () => {
    const onChangeSpy = vi.fn();
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="idle"
        phaseDurationMs={25 * 60 * 1000}
        onChange={onChangeSpy}
        onRestoreDefaults={vi.fn()}
      />
    );

    const focusSlider = screen.getByRole('slider', { name: 'Focus duration' }) as HTMLInputElement;
    const shortSlider = screen.getByRole('slider', { name: 'Short break' }) as HTMLInputElement;
    const longSlider = screen.getByRole('slider', { name: 'Long break' }) as HTMLInputElement;
    const roundsSlider = screen.getByRole('slider', { name: 'Session rounds' }) as HTMLInputElement;

    expect(focusSlider.value).toBe('25');
    expect(shortSlider.value).toBe('5');
    expect(longSlider.value).toBe('15');
    expect(roundsSlider.value).toBe('4');

    fireEvent.change(focusSlider, { target: { value: '35' } });
    expect(onChangeSpy).toHaveBeenCalledWith({ focusMinutes: 35 });

    fireEvent.change(shortSlider, { target: { value: '8' } });
    expect(onChangeSpy).toHaveBeenCalledWith({ shortBreakMinutes: 8 });

    fireEvent.change(longSlider, { target: { value: '20' } });
    expect(onChangeSpy).toHaveBeenCalledWith({ longBreakMinutes: 20 });

    fireEvent.change(roundsSlider, { target: { value: '6' } });
    expect(onChangeSpy).toHaveBeenCalledWith({ longBreakEvery: 6 });
  });

  it('calls onClose when close button is clicked or Escape key is pressed', () => {
    const onCloseSpy = vi.fn();
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="idle"
        phaseDurationMs={25 * 60 * 1000}
        onChange={vi.fn()}
        onRestoreDefaults={vi.fn()}
        onClose={onCloseSpy}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(onCloseSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseSpy).toHaveBeenCalledTimes(2);
  });

  it('renders the Special Breaks section with 4 placeholder time boxes', () => {
    render(
      <TimerSettingsPanel
        settings={DEFAULT_POMODORO_SETTINGS}
        status="idle"
        phaseDurationMs={25 * 60 * 1000}
        onChange={vi.fn()}
        onRestoreDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Special Breaks' })).toBeTruthy();
    const placeholders = screen.getAllByText('-- : --');
    expect(placeholders).toHaveLength(4);
  });
});
