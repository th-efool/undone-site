/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlaySkeleton } from '../PlaySkeleton';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlaySkeleton component', () => {
  it('renders loading skeleton with status role and shimmering components', () => {
    const { container } = render(<PlaySkeleton />);

    const statusEl = screen.getByRole('status', { name: /loading lessons/i });
    expect(statusEl).toBeDefined();

    const shimmers = container.querySelectorAll('[class*="shimmer"]');
    expect(shimmers.length).toBeGreaterThan(5);
  });

  it('renders error state with alert role, error title, and reload action', () => {
    const onRetry = vi.fn();
    render(
      <PlaySkeleton
        isError
        errorMessage="Network connection timed out."
        onRetry={onRetry}
      />
    );

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeDefined();
    expect(screen.getByText('Lessons Could Not Be Loaded')).toBeDefined();
    expect(screen.getByText('Network connection timed out.')).toBeDefined();

    const reloadBtn = screen.getByRole('button', { name: /reload lessons/i });
    fireEvent.click(reloadBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    const homeLink = screen.getByRole('link', { name: /back home/i });
    expect(homeLink.getAttribute('href')).toBe('/home');
  });

  it('renders empty state with status role, caught-up title, and refresh action', () => {
    const onRetry = vi.fn();
    render(
      <PlaySkeleton
        isEmpty
        errorTitle="All Caught Up"
        errorMessage="You've finished all lessons in this channel."
        onRetry={onRetry}
        retryLabel="Refresh Channel"
      />
    );

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
    expect(screen.getByText('All Caught Up')).toBeDefined();
    expect(screen.getByText("You've finished all lessons in this channel.")).toBeDefined();

    const refreshBtn = screen.getByRole('button', { name: /refresh channel/i });
    fireEvent.click(refreshBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    const homeLink = screen.getByRole('link', { name: /back home/i });
    expect(homeLink.getAttribute('href')).toBe('/home');
  });
});
