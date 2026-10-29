// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RecommendationPending } from '../RecommendationPending';

describe('RecommendationPending Component (Issue 7 Anti-Skeleton)', () => {
  afterEach(() => {
    cleanup();
  });

  const createMockCreation = (status: 'running' | 'idle' | 'canceled', overrides: Record<string, unknown> = {}) => ({
    snapshot: {
      status,
      error: null,
      query: 'Machine Learning',
      result: null,
      ...overrides,
    },
    cancel: vi.fn(),
    runQuery: vi.fn(),
    queryPending: false,
  });

  it('renders status feedback and cancel button during running state without fake skeleton placeholder cards', () => {
    const mockCreation = createMockCreation('running');
    const { container } = render(<RecommendationPending creation={mockCreation as unknown as Parameters<typeof RecommendationPending>[0]['creation']} />);

    // Must display authentic heading and status feedback
    expect(screen.getByRole('heading', { name: 'Finding your people…' })).toBeTruthy();
    const statusBox = screen.getByRole('status');
    expect(statusBox).toBeTruthy();
    expect(statusBox.textContent).toContain('Searching for matching cohorts and creators right now…');

    // Must preserve cancellation capability
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn);
    expect(mockCreation.cancel).toHaveBeenCalledTimes(1);

    // Must NOT contain any fake skeleton placeholder cards or containers
    expect(container.querySelector('[class*="skeleton"]')).toBeNull();
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it('renders interactive query form in idle state without skeleton placeholders', () => {
    const mockCreation = createMockCreation('idle');
    const { container } = render(<RecommendationPending creation={mockCreation as unknown as Parameters<typeof RecommendationPending>[0]['creation']} />);

    expect(screen.getByRole('heading', { name: 'What will you learn?' })).toBeTruthy();
    expect(screen.getByLabelText('Your learning query')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Find cohorts' })).toBeTruthy();

    expect(container.querySelector('[class*="skeleton"]')).toBeNull();
  });

  it('preserves query and offers retry in canceled state without skeleton placeholders', () => {
    const mockCreation = createMockCreation('canceled');
    const { container } = render(<RecommendationPending creation={mockCreation as unknown as Parameters<typeof RecommendationPending>[0]['creation']} />);

    expect(screen.getByText('Generation stopped. Your query is still here.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();

    expect(container.querySelector('[class*="skeleton"]')).toBeNull();
  });
});
