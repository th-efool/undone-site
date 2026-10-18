// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { EventsPage } from '../EventsPage/EventsPage';
import type { CohortEvents } from '../../../../models';

describe('EventsPage Actions (EventsPage & CalendarSync)', () => {
  afterEach(() => {
    cleanup();
  });
  const mockEvents: CohortEvents = {
    title: 'Cohort Live Events',
    description: 'Upcoming cohort events and sync.',
    filters: [{ id: 'all', label: 'All Events', active: true }],
    upcomingEvents: [
      {
        id: 'ev-1',
        title: 'Weekly Office Hours',
        description: 'Ask any questions about the curriculum',
        date: { day: '15', month: 'OCT', weekday: 'WED' },
        time: '6:00 PM',
        timezone: 'UTC',
        platform: 'Discord',
        status: 'upcoming' as any,
        avatars: [],
        attendeeCount: '12',
      },
    ],
    weeklySchedule: [],
    calendarSync: [
      { id: 'google', label: 'Google Calendar', icon: '📅' },
      { id: 'apple', label: 'Apple / iCal', icon: '🍏' },
    ],
    suggestEvent: {
      title: 'Host an Event',
      description: 'Host a community study session',
      buttonLabel: 'Suggest',
      illustration: '',
    },
  };

  it('opens calendar sync modal when "View Full Calendar" is clicked', () => {
    render(<EventsPage events={mockEvents} />);

    // Initially modal is not shown
    expect(screen.queryByRole('dialog')).toBeNull();

    // Click "View Full Calendar"
    const button = screen.getByRole('button', { name: /view full calendar/i });
    fireEvent.click(button);

    // Modal dialog is mounted
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByText('Full Cohort Calendar')).toBeTruthy();
    expect(screen.getAllByText('Google Calendar').length).toBeGreaterThan(0);

    // Close the modal
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('triggers Google Calendar link on Google sync click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<EventsPage events={mockEvents} />);

    const button = screen.getByRole('button', { name: /view full calendar/i });
    fireEvent.click(button);

    const googleBtn = screen.getAllByRole('button', { name: /google calendar/i })[0];
    fireEvent.click(googleBtn);

    expect(openSpy).toHaveBeenCalled();
    const calledUrl = openSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('calendar.google.com/calendar/render');
    expect(calledUrl).toContain('Weekly%20Office%20Hours');

    openSpy.mockRestore();
  });
});
