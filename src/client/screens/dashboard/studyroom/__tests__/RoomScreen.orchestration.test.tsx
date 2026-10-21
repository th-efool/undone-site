/* eslint-disable @typescript-eslint/no-explicit-any */
/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomScreen } from '../room/RoomScreen';
import { studyRoomRepository } from '@/src/client/repositories/studyRoomRepository';

const pushSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'test-user', name: 'Test User' },
    },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/client/realtime', () => ({
  useRealtime: () => ({
    refreshManifest: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('RoomScreen orchestration stages (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders loading stage while orchestration is initializing', () => {
    // Hang bootstrap promise to keep in loading state
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockReturnValue(new Promise(() => {}));

    render(<RoomScreen roomSlug="cozy-library" />);

    expect(screen.getByTestId('room-loading-stage')).toBeTruthy();
    expect(screen.getByText('Connecting to Study Room...')).toBeTruthy();
  });

  it('renders switched_elsewhere stage when lease renewal reports stale_generation', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: {
        id: 'room-1',
        slug: 'fireplace',
        title: 'Fireplace Room',
        status: 'OPEN',
        capacity: 25,
        onlineCount: 2,
        ownerId: 'host-1',
        createdAt: new Date().toISOString(),
      },
      viewer: { userId: 'test-user', isJoined: true, role: 'MEMBER' },
      capabilities: { canJoin: true, isOwner: false },
    } as any);

    vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
      success: true,
      roomId: 'room-1',
      generation: 1,
      isSwitch: false,
      lease: { leaseId: 'l-1', tabId: 'tab-1', expiresAt: '' },
    });

    // Mock renewal returning 409 stale_generation
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/studyroom' && typeof init?.body === 'string' && init.body.includes('"action":"renew"')) {
        return {
          status: 409,
          ok: false,
          json: async () => ({ error: 'Stale', reason: 'stale_generation' }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ([]),
      } as any;
    });

    render(<RoomScreen roomSlug="fireplace" />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(screen.getByTestId('room-switched-stage')).toBeTruthy();
    expect(screen.getByText('Active Room Changed')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Rejoin This Room/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Browse Study Rooms/i })).toBeTruthy();
  });

  it('renders unavailable stage when room cannot be found', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockRejectedValueOnce(
      Object.assign(new Error('Room not found'), { status: 404 })
    );

    render(<RoomScreen roomSlug="missing-slug" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('room-unavailable-stage')).toBeTruthy();
    expect(screen.getByText('Room Unavailable')).toBeTruthy();

    const browseBtn = screen.getByRole('button', { name: /Browse Study Rooms/i });
    fireEvent.click(browseBtn);
    expect(pushSpy).toHaveBeenCalledWith('/studyroom');
  });
});
