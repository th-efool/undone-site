// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StudyRoomLoading from '../loading';
import StudyRoomScreen from '@/src/client/screens/dashboard/studyroom/StudyRoomScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/studyroom',
  useSearchParams: () => new URLSearchParams(),
}));

const mockRooms = [
  { id: '1', slug: 'library', title: 'Library', status: 'OPEN', listing: 'PUBLIC', scopeKind: 'STANDALONE', capacity: 20, onlineCount: 2, tags: [], language: 'en', createdAt: '2026-10-20' },
  { id: '2', slug: 'fireplace', title: 'Fireplace', status: 'OPEN', listing: 'PUBLIC', scopeKind: 'STANDALONE', capacity: 20, onlineCount: 2, tags: [], language: 'en', createdAt: '2026-10-20' },
  { id: '3', slug: 'developer-den', title: 'Developer Den', status: 'OPEN', listing: 'PUBLIC', scopeKind: 'STANDALONE', capacity: 20, onlineCount: 2, tags: [], language: 'en', createdAt: '2026-10-20' },
];

describe('Study Room Route Loading Boundary & Anti-Skeleton Verification', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/studyroom')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rooms: mockRooms }),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the real Study Room workspace composition during loading instead of fake skeleton cards', async () => {
    const { container } = render(<StudyRoomLoading />);

    // Must render the real header and room titles
    expect(screen.getByRole('heading', { level: 1, name: 'Study Rooms' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Fireplace' })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: 'Developer Den' })).toBeTruthy();
    });

    // Must NOT contain any fake skeleton cards or grid
    expect(container.querySelector('[class*="skeletonGrid"]')).toBeNull();
    expect(container.querySelector('[class*="skeletonCard"]')).toBeNull();
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
  });

  it('contains zero skeleton or shimmer classes when rendering StudyRoomScreen directly', async () => {
    const { container } = render(<StudyRoomScreen />);

    expect(screen.getByRole('heading', { level: 1, name: 'Study Rooms' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Fireplace' })).toBeTruthy();
    });
    expect(container.querySelector('[class*="skeletonGrid"]')).toBeNull();
    expect(container.querySelector('[class*="skeletonCard"]')).toBeNull();
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
  });
});
