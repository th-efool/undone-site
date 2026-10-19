/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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
});
