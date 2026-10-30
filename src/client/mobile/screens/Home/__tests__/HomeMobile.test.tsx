/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeMobile } from '../HomeMobile';
import type { UseHomeResult } from '@/src/client/screens/dashboard/home/hooks/useHome';
import type { ActiveCohort, PausedCohort } from '@/src/client/screens/dashboard/home/models';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <span data-testid="mock-img" data-src={props.src} />,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock('@/src/client/screens/dashboard/home/components/ChannelHub/ChannelHub', () => ({
  ChannelHub: () => <div data-testid="channel-hub">Channel Hub</div>,
}));

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mockActiveCohort: ActiveCohort = {
  id: 'active-1',
  cohortId: 'active-1',
  rank: 1,
  title: 'Active Systems Quest',
  provider: 'MIT',
  thumbnail: '/mit.jpg',
  minutesToday: 10,
  dailyGoalMinutes: 30,
  progressPercent: 50,
  schedule: { days: ['Mon', 'Wed'], label: 'Mon, Wed' },
};

const mockPausedCohort: PausedCohort = {
  id: 'paused-1',
  cohortId: 'paused-1',
  rank: 2,
  title: 'Paused Deep Learning',
  provider: 'DeepLearning.AI',
  thumbnail: '/dl.jpg',
  minutesToday: 0,
  dailyGoalMinutes: 20,
  progressPercent: 20,
  pausedUntil: new Date(Date.now() + 86400000 * 7).toISOString(),
  resumeLabel: 'Resume',
  schedule: { days: ['Fri'], label: 'Fri' },
};

function createMockHomeResult(overrides: Partial<UseHomeResult> = {}): UseHomeResult {
  return {
    loading: false,
    isSyncing: false,
    mutationPending: false,
    syncError: null,
    isAuthenticated: true,
    hero: { title: 'Welcome Back', subtitle: 'Ready to learn?' },
    searchPlaceholder: 'Search cohorts…',
    sections: {
      activeCohorts: { title: 'Subscribed Cohorts' },
      recentlyCompleted: { title: 'Completed Cohorts' },
    },
    summaries: [],
    activeCohorts: [mockActiveCohort],
    continueLater: [mockPausedCohort],
    recentlyCompleted: [],
    actions: {
      pauseActiveCohort: vi.fn(),
      resumePausedCohort: vi.fn(),
      saveLearningSettings: vi.fn(),
      removeSubscribedCohort: vi.fn(),
    },
    ...overrides,
  } as unknown as UseHomeResult;
}

describe('HomeMobile', () => {
  it('renders both active and paused cohorts, showing Resume button for desktop-paused cohort', () => {
    const model = createMockHomeResult();
    render(<HomeMobile model={model} />);

    expect(screen.getByText('Active Systems Quest')).toBeTruthy();
    expect(screen.getByText('Paused Deep Learning')).toBeTruthy();

    const resumeBtn = screen.getByRole('button', { name: 'Resume Paused Deep Learning' });
    expect(resumeBtn).toBeTruthy();
    fireEvent.click(resumeBtn);
    expect(model.actions.resumePausedCohort).toHaveBeenCalledWith('paused-1');
  });

  it('provides an accessible search input that filters both active and paused cohorts', () => {
    const model = createMockHomeResult();
    render(<HomeMobile model={model} />);

    const searchInput = screen.getByLabelText('Search cohorts');
    expect(searchInput).toBeTruthy();

    // Filter to paused cohort
    fireEvent.change(searchInput, { target: { value: 'deep learning' } });
    expect(screen.queryByText('Active Systems Quest')).toBeNull();
    expect(screen.getByText('Paused Deep Learning')).toBeTruthy();

    // Filter to active cohort
    fireEvent.change(searchInput, { target: { value: 'systems' } });
    expect(screen.getByText('Active Systems Quest')).toBeTruthy();
    expect(screen.queryByText('Paused Deep Learning')).toBeNull();
  });

  it('displays "No matching cohorts found." when search matches nothing, distinct from empty subscriptions', () => {
    const model = createMockHomeResult();
    render(<HomeMobile model={model} />);

    const searchInput = screen.getByLabelText('Search cohorts');
    fireEvent.change(searchInput, { target: { value: 'nonexistent query xyz' } });

    expect(screen.getByText('No matching cohorts found.')).toBeTruthy();
    expect(screen.queryByText('Discover cohorts')).toBeNull();
  });

  it('displays "Discover cohorts" link when user has no subscribed cohorts and no search query', () => {
    const model = createMockHomeResult({ activeCohorts: [], continueLater: [] });
    render(<HomeMobile model={model} />);

    expect(screen.getByText('Discover cohorts')).toBeTruthy();
  });

  it('renders ChannelHub component', () => {
    const model = createMockHomeResult();
    render(<HomeMobile model={model} />);

    expect(screen.getByTestId('channel-hub')).toBeTruthy();
  });

  it('renders syncError when present with role="alert"', () => {
    const model = createMockHomeResult({ syncError: 'Network failure syncing changes' });
    render(<HomeMobile model={model} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Network failure syncing changes');
  });

  it('renders RecentlyCompleted when completed items exist and toggles open/close', () => {
    const model = createMockHomeResult({
      recentlyCompleted: [
        {
          id: 'comp-1',
          title: 'Finished Quest',
          thumbnail: '/finished.jpg',
          completedLabel: 'Completed Oct 2026',
          progressPercent: 100,
        },
      ],
    });
    render(<HomeMobile model={model} />);

    // Initially collapsed
    expect(screen.getByText('Completed Cohorts')).toBeTruthy();
    expect(screen.queryByText('Finished Quest')).toBeNull();

    // Expand
    fireEvent.click(screen.getByRole('button', { name: 'Expand completed cohorts' }));
    expect(screen.getByText('Finished Quest')).toBeTruthy();

    // Collapse
    fireEvent.click(screen.getByRole('button', { name: 'Collapse completed cohorts' }));
    expect(screen.queryByText('Finished Quest')).toBeNull();
  });

  it('forwards mutationPending to disable interactive actions during sync', () => {
    const model = createMockHomeResult({ mutationPending: true });
    render(<HomeMobile model={model} />);

    const pauseBtn = screen.getByRole('button', { name: 'Pause Active Systems Quest' }) as HTMLButtonElement;
    expect(pauseBtn.disabled).toBe(true);
  });
});
