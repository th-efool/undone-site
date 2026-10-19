// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PlayLoading from '../loading';

// Mock next-auth and session safely
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Tester' } },
    status: 'authenticated',
  }),
}));

// Mock useSearchParams
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/play',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('Play Route Loading Boundary (Issue 2)', () => {
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

  it('renders the real Play player shell during loading instead of obsolete mock skeleton', () => {
    const { container } = render(<PlayLoading />);

    // Header must be present
    expect(screen.getByRole('banner', { name: /playback header/i })).toBeDefined();

    // Stage status loader must be present
    expect(screen.getByRole('status', { name: /loading lessons/i })).toBeDefined();

    // Bottom dock must be present
    expect(screen.getByRole('toolbar', { name: /playback controls dock/i })).toBeDefined();

    // Must NOT contain obsolete PageSkeleton mock elements
    expect(container.querySelector('[class*="videoPlaceholder"]')).toBeNull();
    expect(container.querySelector('[class*="timelineBar"]')).toBeNull();
    expect(container.querySelector('[class*="controlsRow"]')).toBeNull();
    expect(container.querySelector('[class*="lessonCard"]')).toBeNull();

    // Must NOT contain any shimmer elements
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders mobile player shell when viewport is mobile without shimmer', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('max-width: 768px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<PlayLoading />);

    // Mobile playback header must be present
    expect(screen.getByRole('banner', { name: /playback header/i })).toBeDefined();

    // Zero shimmer elements
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });
});
