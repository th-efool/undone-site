/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StudyRoomScreen from '../StudyRoomScreen';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'user-123',
        name: 'Alex Developer',
        image: 'https://example.com/alex.jpg',
      },
    },
    status: 'authenticated',
  }),
}));

const mockRooms = [
  {
    id: 'room-fireplace',
    title: 'Fireplace',
    thumbnail: '/images/studyrooms/fireplace.webp',
    status: 'ACTIVE',
    onlineCount: 2,
    participants: [
      { id: 'p1', userId: 'user-peer-1', user: { id: 'user-peer-1', name: 'Sarah', image: null, username: 'sarah' } },
      { id: 'p2', userId: 'user-peer-2', user: { id: 'user-peer-2', name: 'Sam', image: null, username: 'sam' } },
    ],
  },
  {
    id: 'room-library',
    title: 'Library',
    thumbnail: '/images/studyrooms/library.webp',
    status: 'ACTIVE',
    onlineCount: 0,
    participants: [],
  },
];

describe('StudyRoomScreen Optimistic UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('optimistically joins room and updates UI immediately before server responds', async () => {
    let resolveJoin!: (res: Response) => void;
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveJoin = resolve;
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockRooms,
      } as Response);
    });

    render(<StudyRoomScreen />);

    // Wait for initial rooms load
    await waitFor(() => {
      expect(screen.getByText('Fireplace')).toBeTruthy();
    });

    // Check initial counts and state
    expect(screen.getByText('2 Active')).toBeTruthy();
    const joinButtons = screen.getAllByRole('button', { name: /Join Space/i });
    expect(joinButtons).toHaveLength(2);

    // Click "Join Space" for Fireplace (first room)
    fireEvent.click(joinButtons[0]);

    // 1. Optimistic assertion: Immediately updates participant count to 3
    expect(screen.getByText('3 Active')).toBeTruthy();
    // Immediately shows "YOU ARE HERE" badge
    expect(screen.getByText('YOU ARE HERE')).toBeTruthy();
    // Button immediately flips to "Leave Room"
    expect(screen.getByRole('button', { name: /Leave Room/i })).toBeTruthy();
    // Top banner shows active room
    expect(screen.getByText(/Active in:/i)).toBeTruthy();

    // 2. Resolve server promise
    resolveJoin({ ok: true, json: async () => ({ success: true }) } as Response);

    // State remains joined
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Leave Room/i })).toBeTruthy();
    });
  });

  it('rolls back room state when server join operation fails', async () => {
    let rejectJoin!: (err: Error) => void;
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return new Promise<Response>((_, reject) => {
          rejectJoin = reject;
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockRooms,
      } as Response);
    });

    render(<StudyRoomScreen />);

    await waitFor(() => {
      expect(screen.getByText('Fireplace')).toBeTruthy();
    });

    const joinButton = screen.getAllByRole('button', { name: /Join Space/i })[0];
    fireEvent.click(joinButton);

    // Optimistically joined
    expect(screen.getByText('3 Active')).toBeTruthy();

    // Reject the join request
    rejectJoin(new Error('Network drop'));

    // Rolls back to 2 Active and restores Join button
    await waitFor(() => {
      expect(screen.getByText('2 Active')).toBeTruthy();
      expect(screen.queryByText('YOU ARE HERE')).toBeNull();
      expect(screen.getByText(/Changes restored/i)).toBeTruthy();
    });
  });

  it('optimistically leaves room immediately and rolls back if leave fails', async () => {
    const userInRoom = [
      {
        ...mockRooms[0],
        onlineCount: 3,
        participants: [
          ...mockRooms[0].participants,
          { id: 'p-me', userId: 'user-123', user: { id: 'user-123', name: 'Alex Developer', image: null, username: 'alex' } },
        ],
      },
      mockRooms[1],
    ];

    let resolveLeave!: (res: Response) => void;
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveLeave = resolve;
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => userInRoom,
      } as Response);
    });

    render(<StudyRoomScreen />);

    // Wait for user to be inside Fireplace room
    await waitFor(() => {
      expect(screen.getByText('YOU ARE HERE')).toBeTruthy();
      expect(screen.getByText('3 Active')).toBeTruthy();
    });

    const leaveButton = screen.getByRole('button', { name: /Leave Room/i });
    fireEvent.click(leaveButton);

    // 1. Optimistic assertion: immediately reverts to 2 Active and "Join Space"
    expect(screen.getByText('2 Active')).toBeTruthy();
    expect(screen.queryByText('YOU ARE HERE')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Join Space/i })).toHaveLength(2);

    // 2. Simulate server failure on leave
    resolveLeave({ ok: false, json: async () => ({ error: 'Leave failed on server' }) } as Response);

    // Rolls back to 3 Active and YOU ARE HERE
    await waitFor(() => {
      expect(screen.getByText('3 Active')).toBeTruthy();
      expect(screen.getByText('YOU ARE HERE')).toBeTruthy();
    });
  });

  it('pauses polling when tab is hidden and resumes immediately when visible', async () => {
    vi.useFakeTimers();

    try {
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ ETag: 'W/"test-etag"' }),
          json: async () => mockRooms,
        } as unknown as Response)
      );

      // Start visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });

      render(<StudyRoomScreen />);

      // Initial mount triggers 1 fetch
      await act(async () => {
        await Promise.resolve();
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Advance 10s -> polling fires (2nd fetch)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Hide tab -> visibilitychange event fired
      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          writable: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Advance 30s while hidden -> polling MUST be paused, no fetch triggered
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Unhide tab -> immediately triggers fetch
      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          writable: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Advance another 10s while visible -> polling resumes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(global.fetch).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
    }
  });

  it('sends If-None-Match header on subsequent polls and preserves room state on 304 response', async () => {
    let callCount = 0;
    const initialETag = 'W/"cm9vbS0xOjI6dXNlcg=="';

    global.fetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        // First call: 200 OK with ETag
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ ETag: initialETag }),
          json: async () => mockRooms,
        } as unknown as Response);
      }

      // Subsequent call: check If-None-Match header
      const reqHeaders = options?.headers as Record<string, string> | undefined;
      if (reqHeaders && reqHeaders['If-None-Match'] === initialETag) {
        return Promise.resolve({
          ok: false,
          status: 304,
          headers: new Headers({ ETag: initialETag }),
          json: async () => {
            throw new Error('304 response should not call json()');
          },
        } as unknown as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: initialETag }),
        json: async () => mockRooms,
      } as unknown as Response);
    });

    render(<StudyRoomScreen />);

    // 1. Initial load
    await waitFor(() => {
      expect(screen.getByText('Fireplace')).toBeTruthy();
      expect(screen.getByText('2 Active')).toBeTruthy();
    });

    // 2. Trigger a second fetch via visibility change
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Verify second fetch sent If-None-Match header
    expect(callCount).toBe(2);
    const lastFetchOptions = (global.fetch as any).mock.calls[1][1];
    expect(lastFetchOptions?.headers?.['If-None-Match']).toBe(initialETag);

    // 3. Verify room state was preserved on 304 without crashing or clearing state
    expect(screen.getByText('Fireplace')).toBeTruthy();
    expect(screen.getByText('2 Active')).toBeTruthy();
    expect(screen.getByText('Library')).toBeTruthy();
  });
});
