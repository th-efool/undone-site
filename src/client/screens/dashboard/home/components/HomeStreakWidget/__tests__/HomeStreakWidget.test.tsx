/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeStreakWidget } from '../HomeStreakWidget';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <span data-testid="mock-img" data-src={props.src} />,
}));

afterEach(() => {
  cleanup();
});

describe('HomeStreakWidget', () => {
  it('renders neutral message when activity data is absent without chart or streak ratio', () => {
    render(<HomeStreakWidget />);

    expect(screen.getByText('Activity statistics are not available yet')).toBeTruthy();
    expect(screen.queryByText(/day streak/i)).toBeNull();
    expect(screen.queryByText(/12 days strong/i)).toBeNull();
  });

  it('renders correct 0 values when explicitly supplied with 0 minutes and 0 days streak', () => {
    render(
      <HomeStreakWidget
        todayMinutes={0}
        dailyGoalMinutes={25}
        streakDays={0}
        weekActivity={[false, false, false, false, false, false, false]}
        weekBarHeights={[0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]}
      />,
    );

    expect(screen.queryByText('Activity statistics are not available yet')).toBeNull();
    expect(screen.getByText(/0 \/ 25 min • 0 day streak/i)).toBeTruthy();
  });

  it('renders verified positive values correctly', () => {
    render(
      <HomeStreakWidget
        todayMinutes={15}
        dailyGoalMinutes={30}
        streakDays={5}
        weekActivity={[true, true, true, false, false, false, false]}
        weekBarHeights={[0.5, 0.5, 0.5, 0, 0, 0, 0]}
      />,
    );

    expect(screen.getByText(/15 \/ 30 min • 5 day streak/i)).toBeTruthy();
    expect(screen.queryByText(/12 days strong/i)).toBeNull();
  });
});
