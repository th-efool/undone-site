/* eslint-disable @typescript-eslint/no-explicit-any */
/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRoomOrchestration, getTabId } from '../hooks/useRoomOrchestration';
import { studyRoomRepository } from '@/src/client/repositories/studyRoomRepository';

const mockRefreshManifest = vi.fn().mockResolvedValue(undefined);
let lastPublicationHandler: ((data: unknown) => void) | null = null;
const mockSubscribe = vi.fn((_channel: string, handler?: (data: unknown) => void) => {
  if (handler) lastPublicationHandler = handler;
  return vi.fn();
});

vi.mock('@/src/client/realtime', () => ({
  useRealtime: () => ({
    refreshManifest: mockRefreshManifest,
    subscribe: mockSubscribe,
    status: 'connected',
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'test-user-1', name: 'Test User' },
    },
    status: 'authenticated',
  }),
}));

describe('useRoomOrchestration hook (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('generates and persists tabId in sessionStorage', () => {
    const tab1 = getTabId();
    expect(tab1).toMatch(/^tab-/);
    const tab2 = getTabId();
    expect(tab2).toBe(tab1);
    expect(window.sessionStorage.getItem('studyroom_tab_id')).toBe(tab1);
  });

  it('starts in loading and reaches joined state upon valid bootstrap and join', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: {
        id: 'room-1',
        slug: 'lofi-cafe',
        title: 'Lo-Fi Cafe',
        description: 'Cozy study spot',
        status: 'OPEN',
        capacity: 25,
        onlineCount: 2,
        ownerId: 'host-1',
        ownerName: 'Host',
        createdAt: new Date().toISOString(),
      },
      viewer: {
        userId: 'test-user-1',
        isJoined: false,
        role: 'MEMBER',
      },
      capabilities: {
        canJoin: true,
        canControlEnvironment: false,
        canManageParticipants: false,
        canEditRoom: false,
        canTransferOwnership: false,
        canDeleteRoom: false,
        isOwner: false,
        eligibilityReason: 'ELIGIBLE',
      },
    } as any);

    vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
      success: true,
      roomId: 'room-1',
      generation: 42,
      isSwitch: false,
      lease: {
        leaseId: 'lease-abc',
        tabId: getTabId(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    });

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'lofi-cafe' })
    );

    expect(result.current.state).toBe('loading');

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state).toBe('joined');
    expect(result.current.generation).toBe(42);
    expect(result.current.bootstrap?.room?.id).toBe('room-1');
    expect(result.current.roomDefinition.title).toBe('Lo-Fi Cafe');
    expect(result.current.viewer.userId).toBe('test-user-1');
    expect(result.current.error).toBeNull();
  });

  it('transitions to denied when capabilities.canJoin is false', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: {
        id: 'room-full',
        slug: 'full-room',
        title: 'Full Room',
        status: 'OPEN',
        capacity: 25,
        onlineCount: 25,
        ownerId: 'host-1',
        createdAt: new Date().toISOString(),
      },
      viewer: {
        userId: 'test-user-1',
        isJoined: false,
        role: 'VIEWER',
      },
      capabilities: {
        canJoin: false,
        canControlEnvironment: false,
        canManageParticipants: false,
        canEditRoom: false,
        canTransferOwnership: false,
        canDeleteRoom: false,
        isOwner: false,
        eligibilityReason: 'ROOM_FULL',
      },
    } as any);

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'full-room' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state).toBe('denied');
    expect(result.current.generation).toBeNull();
  });

  it('transitions to unavailable when bootstrap fetch fails', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockRejectedValueOnce(
      new Error('Room not found')
    );

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'missing-room' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state).toBe('unavailable');
    expect(result.current.error).toBe('Room not found');
  });

  it('detects 409 stale_generation on renewal and switches to switched_elsewhere', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: {
        id: 'room-active',
        slug: 'active-room',
        title: 'Active Room',
        status: 'OPEN',
        capacity: 25,
        onlineCount: 1,
        ownerId: 'host-1',
        createdAt: new Date().toISOString(),
      },
      viewer: {
        userId: 'test-user-1',
        isJoined: true,
      },
      capabilities: {
        canJoin: true,
        canControlEnvironment: false,
        canManageParticipants: false,
        canEditRoom: false,
        canTransferOwnership: false,
        canDeleteRoom: false,
        isOwner: false,
      },
    } as any);

    vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
      success: true,
      roomId: 'room-active',
      generation: 10,
      isSwitch: false,
      lease: {
        leaseId: 'lease-10',
        tabId: getTabId(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    });

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'active-room' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state).toBe('joined');
    expect(result.current.generation).toBe(10);

    // Mock renewal returning 409 stale_generation
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: async () => ({
        error: 'Stale participant generation',
        reason: 'stale_generation',
      }),
    } as any);

    // Advance 30s lease renewal timer
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(result.current.state).toBe('switched_elsewhere');
  });

  it('leave(false) calls leaveRoom with global=false and cleans up state', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: { id: 'room-1', slug: 'room-1', title: 'Room 1', status: 'OPEN', capacity: 25, onlineCount: 1, ownerId: 'h-1', createdAt: '' },
      viewer: { userId: 'u-1', isJoined: true },
      capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
    } as any);

    vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
      success: true,
      roomId: 'room-1',
      generation: 1,
      isSwitch: false,
      lease: { leaseId: 'l-1', tabId: getTabId(), expiresAt: '' },
    });

    const leaveSpy = vi.spyOn(studyRoomRepository, 'leaveRoom').mockResolvedValueOnce({
      success: true,
      left: true,
    });

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'room-1' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state).toBe('joined');

    await act(async () => {
      await result.current.leave(false);
    });

    expect(leaveSpy).toHaveBeenCalledWith('room-1', expect.any(String), false);
    expect(result.current.state).toBe('unavailable');
    expect(result.current.generation).toBeNull();
  });

  it('leave(true) calls leaveRoom with global=true', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: { id: 'room-2', slug: 'room-2', title: 'Room 2', status: 'OPEN', capacity: 25, onlineCount: 1, ownerId: 'h-1', createdAt: '' },
      viewer: { userId: 'u-1', isJoined: true },
      capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
    } as any);

    vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
      success: true,
      roomId: 'room-2',
      generation: 2,
      isSwitch: false,
      lease: { leaseId: 'l-2', tabId: getTabId(), expiresAt: '' },
    });

    const leaveSpy = vi.spyOn(studyRoomRepository, 'leaveRoom').mockResolvedValueOnce({
      success: true,
      left: true,
    });

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'room-2' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.leave(true);
    });

    expect(leaveSpy).toHaveBeenCalledWith('room-2', expect.any(String), true);
  });

  it('refreshBootstrap fetches updated room and calls realtime.refreshManifest()', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: { id: 'room-3', slug: 'room-3', title: 'Room 3', status: 'OPEN', capacity: 25, onlineCount: 1, ownerId: 'h-1', createdAt: '' },
      viewer: { userId: 'u-1', isJoined: true },
      capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
    } as any);

    vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
      success: true,
      roomId: 'room-3',
      generation: 3,
      isSwitch: false,
      lease: { leaseId: 'l-3', tabId: getTabId(), expiresAt: '' },
    });

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'room-3' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: { id: 'room-3', slug: 'room-3', title: 'Updated Title', status: 'OPEN', capacity: 25, onlineCount: 1, ownerId: 'h-1', createdAt: '' },
      viewer: { userId: 'u-1', isJoined: true },
      capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
    } as any);

    await act(async () => {
      await result.current.refreshBootstrap();
    });

    expect(mockRefreshManifest).toHaveBeenCalled();
  });

  it('subscribes to room realtime channel and handles room.participant.left KICKED', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: { id: 'room-kick', slug: 'room-kick', title: 'Room Kick', status: 'OPEN', capacity: 25, onlineCount: 2, ownerId: 'h-1', createdAt: '', streamGeneration: 2 },
      viewer: { userId: 'test-user-1', isJoined: false, role: 'MEMBER' },
      capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
    } as any);

    vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
      success: true,
      roomId: 'room-kick',
      generation: 1,
      isSwitch: false,
      lease: { leaseId: 'l-k', tabId: getTabId(), expiresAt: '' },
    });

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'room-kick' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state).toBe('joined');
    expect(mockSubscribe).toHaveBeenCalledWith('room:room-kick:g2', expect.any(Function));

    // Simulate publication of room.participant.left with KICKED
    await act(async () => {
      lastPublicationHandler?.({
        type: 'room.participant.left',
        payload: { userId: 'test-user-1', reason: 'KICKED' },
      });
    });

    expect(result.current.state).toBe('denied');
  });

  it('handles gap in sequence numbers by calling syncRoomEvents catchup', async () => {
    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
      room: { id: 'room-sync', slug: 'room-sync', title: 'Room Sync', status: 'OPEN', capacity: 25, onlineCount: 2, ownerId: 'h-1', createdAt: '', streamGeneration: 1 },
      viewer: { userId: 'test-user-1', isJoined: false, role: 'MEMBER' },
      capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
    } as any);

    vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
      success: true,
      roomId: 'room-sync',
      generation: 1,
      isSwitch: false,
      lease: { leaseId: 'l-s', tabId: getTabId(), expiresAt: '' },
    });

    const syncSpy = vi.spyOn(studyRoomRepository, 'syncRoomEvents').mockResolvedValueOnce({
      mode: 'DELTA',
      roomId: 'room-sync',
      streamId: 's-1',
      currentSequence: 10,
      generation: 1,
      events: [],
      serverTime: new Date().toISOString(),
    });

    const { result } = renderHook(() =>
      useRoomOrchestration({ roomSlug: 'room-sync' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state).toBe('joined');

    // Deliver seq 1
    await act(async () => {
      lastPublicationHandler?.({
        sequence: 1,
        type: 'room.roster.changed',
        payload: { onlineCount: 3 },
      });
    });

    expect(syncSpy).not.toHaveBeenCalled();

    // Deliver seq 5 (gap between 1 and 5!)
    await act(async () => {
      lastPublicationHandler?.({
        sequence: 5,
        type: 'room.roster.changed',
        payload: { onlineCount: 4 },
      });
    });

    expect(syncSpy).toHaveBeenCalledWith('room-sync', { clientSequence: 1 });
  });
});
