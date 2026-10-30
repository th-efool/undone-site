// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HomeLoading from '../loading';
import HomeError from '../error';
import { ActiveCohorts } from '@/src/client/screens/dashboard/home/components/ActiveCohorts/ActiveCohorts';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Tester' } },
    status: 'authenticated',
  }),
}));

describe('Home Route Loading and Error Boundaries (FH-09)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders presentational HomeLoading with status role and no fabricated cohorts or storage writes', () => {
    render(<HomeLoading />);

    expect(screen.getByRole('status', { name: /loading dashboard/i })).toBeDefined();

    // Must NOT contain fabricated cohorts or text
    expect(screen.queryByText(/Neuroscience 101/i)).toBeNull();
    expect(screen.queryByText(/Cities & Urban Systems/i)).toBeNull();
    expect(screen.queryByText(/AI for Creators/i)).toBeNull();

    // Must NOT write to localStorage
    expect(localStorage.length).toBe(0);
  });

  it('renders a restrained indicator inside ActiveCohorts when empty during loading, with zero shimmer', () => {
    const { container } = render(
      <ActiveCohorts
        heading={{ title: 'Subscribed Cohorts' }}
        items={[]}
        isLoading={true}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const loader = screen.getByRole('status', { name: /loading cohorts/i });
    expect(loader).toBeDefined();

    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
  });

  it('renders Discover cohorts link when ActiveCohorts is loaded and empty', () => {
    render(
      <ActiveCohorts
        heading={{ title: 'Subscribed Cohorts' }}
        items={[]}
        isLoading={false}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: /discover cohorts/i })).toBeDefined();
  });

  it('renders HomeError boundary with non-database error message and working retry trigger', () => {
    const reset = vi.fn();
    render(<HomeError error={new Error('Connection to replica set failed')} reset={reset} />);

    // Must NOT print raw database error text
    expect(screen.queryByText(/replica set/i)).toBeNull();
    expect(screen.getByText('Home could not load')).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(reset).toHaveBeenCalledOnce();
  });
});
