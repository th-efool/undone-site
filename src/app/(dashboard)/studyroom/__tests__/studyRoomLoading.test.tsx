// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StudyRoomLoading from '../loading';
import StudyRoomScreen from '@/src/client/screens/dashboard/studyroom/StudyRoomScreen';

// Mock next-auth safely
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Tester' } },
    status: 'authenticated',
  }),
}));

describe('Study Room Route Loading Boundary & Anti-Skeleton Verification (Issue 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'room-1',
          title: 'Fireplace',
          thumbnail: '/rooms/fireplace.jpg',
          status: 'ACTIVE',
          onlineCount: 2,
          participants: [
            {
              id: 'p-1',
              userId: 'u-1',
              user: { id: 'u-1', name: 'Alice', image: null, username: 'alice' },
            },
          ],
        },
        {
          id: 'room-2',
          title: 'Library',
          thumbnail: '/rooms/library.jpg',
          status: 'ACTIVE',
          onlineCount: 0,
          participants: [],
        },
        {
          id: 'room-3',
          title: 'Developer Den',
          thumbnail: '/rooms/dev-den.jpg',
          status: 'ACTIVE',
          onlineCount: 0,
          participants: [],
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the real Study Room workspace composition during loading instead of fake skeleton cards', () => {
    const { container } = render(<StudyRoomLoading />);

    // Must render the real header and workspace titles
    expect(screen.getByText('Focus Cohorts & Study Rooms')).toBeTruthy();
    expect(screen.getByText(/Active Spaces/i)).toBeTruthy();
    expect(screen.getByText('Timer Widget')).toBeTruthy();

    // Must render canonical room cards immediately
    expect(screen.getByText('Fireplace')).toBeTruthy();
    expect(screen.getByText('Library')).toBeTruthy();
    expect(screen.getByText('Developer Den')).toBeTruthy();

    // Must NOT contain any fake skeleton cards or grid
    expect(container.querySelector('[class*="skeletonGrid"]')).toBeNull();
    expect(container.querySelector('[class*="skeletonCard"]')).toBeNull();
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
  });

  it('retains legitimate live-status indicator animations', () => {
    const { container } = render(<StudyRoomScreen />);

    // Legitimate live workspace badge and pulsing indicator dot must be present
    expect(screen.getByText('LIVE WORKSPACE')).toBeTruthy();
    const livePulse = container.querySelector('[class*="livePulse"]');
    expect(livePulse).toBeTruthy();
  });

  it('updates room participant data seamlessly when API returns', async () => {
    render(<StudyRoomScreen />);

    // Wait for the mock API data to populate
    await waitFor(() => {
      expect(screen.getByText('1 Active')).toBeTruthy();
    });

    // Alice should be rendered in the avatar stack
    expect(screen.getByTitle('Alice')).toBeTruthy();

    // Still zero skeletons or shimmer
    expect(document.querySelector('[class*="skeletonGrid"]')).toBeNull();
    expect(document.querySelector('[class*="skeletonCard"]')).toBeNull();
  });
});
