// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HomeLoading from '../loading';
import { ActiveCohorts } from '@/src/client/screens/dashboard/home/components/ActiveCohorts/ActiveCohorts';

// Mock next-auth and session safely
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Tester' } },
    status: 'authenticated',
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: null,
    isLoading: true,
  }),
}));

describe('Home Route Loading Boundary (Issue 1)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the real Home page composition during loading instead of an obsolete skeleton layout', () => {
    const { container } = render(<HomeLoading />);

    // Real Home components must be present
    expect(screen.getByRole('banner', { name: /dashboard hero/i })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.getByRole('region', { name: /subscribed cohorts/i })).toBeDefined();

    // Must NOT contain obsolete 4-card grid, fake cohort bars, or skeleton containers
    expect(container.querySelector('[class*="cardGrid"]')).toBeNull();
    expect(container.querySelector('[class*="summaryCard"]')).toBeNull();
    expect(container.querySelector('[class*="cohortRows"]')).toBeNull();
    expect(container.querySelector('[class*="darkSkeletonContainer"]')).toBeNull();
    expect(container.querySelector('[class*="skeletonContainer"]')).toBeNull();
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

    // Zero shimmer elements
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
  });
});
