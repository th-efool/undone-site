/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpcomingEvents } from '../UpcomingEvents';

vi.mock('@/src/client/hooks/useUnifiedTasks', () => ({
  useUnifiedTasks: () => ({
    tasks: [],
    addTask: vi.fn(),
    updateTask: vi.fn(),
    toggleTask: vi.fn(),
    removeTask: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  // Set system time to 2026-10-30T10:00:00 local time
  vi.setSystemTime(new Date(2026, 9, 30, 10, 0, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('UpcomingEvents calendar and provider honesty (FH-12)', () => {
  it('initializes activeDate and selectedDay from local now (e.g. Oct 30, 2026)', () => {
    render(<UpcomingEvents variant="light" />);

    expect(screen.getByText('October 2026')).toBeTruthy();
    // Default provider is Undone tasks (Sidequest Native)
    expect(screen.getByText('Undone tasks')).toBeTruthy();

    // Check today cell
    const todayCell = screen.getByLabelText(/October 2026 30.*today/i);
    expect(todayCell).toBeTruthy();
  });

  it('updates today marker at local midnight without forcing user back if they navigated to another month', () => {
    render(<UpcomingEvents variant="light" />);

    // Navigate to next month (November 2026)
    const nextBtn = screen.getByLabelText('Next month');
    fireEvent.click(nextBtn);
    expect(screen.getByText('November 2026')).toBeTruthy();

    // Advance fake timer past midnight (14 hours + 2 seconds)
    act(() => {
      vi.advanceTimersByTime(14 * 3600 * 1000 + 2000);
    });

    // Remains on November 2026!
    expect(screen.getByText('November 2026')).toBeTruthy();
  });

  it('defaults to Sidequest Native / Undone tasks and prevents selection of unavailable third-party providers', () => {
    render(<UpcomingEvents variant="light" />);

    // Open provider dropdown
    const providerBtn = screen.getByRole('button', { name: /Calendar integration provider: Undone tasks/i });
    fireEvent.click(providerBtn);

    // Google Calendar should have "Coming later"
    const googleOption = screen.getByText('Google Calendar');
    expect(googleOption).toBeTruthy();
    expect(screen.getAllByText('Coming later').length).toBeGreaterThan(0);

    // Clicking Google Calendar does not switch selected provider
    fireEvent.click(googleOption);
    expect(screen.getByText(/Google Calendar is not connected/i)).toBeTruthy();

    // Provider remains Undone tasks
    expect(screen.getByRole('button', { name: /Calendar integration provider: Undone tasks/i })).toBeTruthy();
  });
});
