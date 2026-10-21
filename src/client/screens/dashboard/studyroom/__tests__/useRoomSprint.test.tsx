/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRoomSprint } from '../hooks/useRoomSprint';
import { studyRoomRepository, type RoomSprintSnapshotDTO } from '@/src/client/repositories/studyRoomRepository';

const mockSubscribe = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-1', name: 'Alice' } },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/client/realtime', () => ({
  useRealtime: vi.fn(() => ({
    subscribe: mockSubscribe,
  })),
}));

vi.mock('@/src/client/repositories/studyRoomRepository', () => ({
  studyRoomRepository: {
    getRoomSprint: vi.fn(),
    startRoomSprint: vi.fn(),
    pauseRoomSprint: vi.fn(),
    resumeRoomSprint: vi.fn(),
    stopRoomSprint: vi.fn(),
    joinRoomSprint: vi.fn(),
    leaveRoomSprint: vi.fn(),
  },
}));

describe('useRoomSprint hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockSprint: RoomSprintSnapshotDTO = {
    id: 'sprint-1',
    studyRoomId: 'room-1',
    creatorId: 'user-1',
    title: 'Deep Focus',
    targetDurationSeconds: 1500,
    elapsedSeconds: 0,
    remainingSeconds: 1500,
    status: 'ACTIVE',
    startedAt: new Date(100_000).toISOString(),
    deadline: new Date(100_000 + 1500 * 1000).toISOString(),
    pausedAt: null,
    endedAt: null,
    version: 1,
    revision: 1,
    participantCount: 1,
    participants: [
      {
        userId: 'user-1',
        name: 'Alice',
        username: 'alice',
        image: '/alice.png',
        status: 'JOINED',
        joinedAt: new Date(100_000).toISOString(),
      },
    ],
  };

  it('hydrates initial sprint snapshot without fetching immediately', () => {
    const { result } = renderHook(() =>
      useRoomSprint({
        roomSlug: 'fireplace',
        initialSprint: mockSprint,
        canControlSprint: true,
      })
    );

    expect(result.current.sprint).toEqual(mockSprint);
    expect(result.current.isJoined).toBe(true);
    expect(result.current.remainingSeconds).toBe(1500);
    expect(result.current.canControl).toBe(true);
  });

  it('fetches room sprint on mount when no initialSprint is provided', async () => {
    vi.mocked(studyRoomRepository.getRoomSprint).mockResolvedValueOnce({
      sprint: mockSprint,
    });

    const { result } = renderHook(() =>
      useRoomSprint({
        roomSlug: 'fireplace',
        canControlSprint: true,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(studyRoomRepository.getRoomSprint).toHaveBeenCalledWith('fireplace');
    expect(result.current.sprint?.id).toBe('sprint-1');
  });

  it('starts a new sprint via startSprint', async () => {
    vi.mocked(studyRoomRepository.startRoomSprint).mockResolvedValueOnce(mockSprint);

    const { result } = renderHook(() =>
      useRoomSprint({
        roomSlug: 'fireplace',
        canControlSprint: true,
      })
    );

    await act(async () => {
      await result.current.startSprint(25, 'Math Review');
    });

    expect(studyRoomRepository.startRoomSprint).toHaveBeenCalledWith('fireplace', 1500, 'Math Review');
    expect(result.current.sprint?.id).toBe('sprint-1');
  });

  it('pauses, resumes, and stops sprint with revision checks', async () => {
    const pausedSprint: RoomSprintSnapshotDTO = {
      ...mockSprint,
      status: 'PAUSED',
      revision: 2,
      remainingSeconds: 1200,
    };
    const resumedSprint: RoomSprintSnapshotDTO = {
      ...mockSprint,
      status: 'ACTIVE',
      revision: 3,
      remainingSeconds: 1200,
    };
    const stoppedSprint: RoomSprintSnapshotDTO = {
      ...mockSprint,
      status: 'CANCELLED',
      revision: 4,
    };

    vi.mocked(studyRoomRepository.pauseRoomSprint).mockResolvedValueOnce(pausedSprint);
    vi.mocked(studyRoomRepository.resumeRoomSprint).mockResolvedValueOnce(resumedSprint);
    vi.mocked(studyRoomRepository.stopRoomSprint).mockResolvedValueOnce(stoppedSprint);

    const { result } = renderHook(() =>
      useRoomSprint({
        roomSlug: 'fireplace',
        initialSprint: mockSprint,
        canControlSprint: true,
      })
    );

    await act(async () => {
      await result.current.pauseSprint();
    });
    expect(studyRoomRepository.pauseRoomSprint).toHaveBeenCalledWith('fireplace', 'sprint-1', 1);
    expect(result.current.sprint?.status).toBe('PAUSED');

    await act(async () => {
      await result.current.resumeSprint();
    });
    expect(studyRoomRepository.resumeRoomSprint).toHaveBeenCalledWith('fireplace', 'sprint-1', 2);
    expect(result.current.sprint?.status).toBe('ACTIVE');

    await act(async () => {
      await result.current.stopSprint();
    });
    expect(studyRoomRepository.stopRoomSprint).toHaveBeenCalledWith('fireplace', 'sprint-1', 3);
    expect(result.current.sprint?.status).toBe('CANCELLED');
  });

  it('recovers from 409 revision conflict by fetching authoritative sprint', async () => {
    const error409 = Object.assign(new Error('Sprint revision conflict'), { status: 409 });
    vi.mocked(studyRoomRepository.pauseRoomSprint).mockRejectedValueOnce(error409);

    const authoritativeSprint: RoomSprintSnapshotDTO = {
      ...mockSprint,
      status: 'PAUSED',
      revision: 5,
    };
    vi.mocked(studyRoomRepository.getRoomSprint).mockResolvedValueOnce({
      sprint: authoritativeSprint,
    });

    const { result } = renderHook(() =>
      useRoomSprint({
        roomSlug: 'fireplace',
        initialSprint: mockSprint,
        canControlSprint: true,
      })
    );

    await act(async () => {
      await result.current.pauseSprint();
    });

    expect(studyRoomRepository.getRoomSprint).toHaveBeenCalledWith('fireplace');
    expect(result.current.sprint?.revision).toBe(5);
    expect(result.current.sprint?.status).toBe('PAUSED');
  });

  it('joins and leaves sprint', async () => {
    const joinedSprint: RoomSprintSnapshotDTO = {
      ...mockSprint,
      participantCount: 2,
      participants: [
        ...mockSprint.participants,
        {
          userId: 'user-2',
          name: 'Bob',
          username: 'bob',
          image: '/bob.png',
          status: 'JOINED',
          joinedAt: new Date(100_000).toISOString(),
        },
      ],
    };

    vi.mocked(studyRoomRepository.joinRoomSprint).mockResolvedValueOnce(joinedSprint);
    vi.mocked(studyRoomRepository.leaveRoomSprint).mockResolvedValueOnce({ success: true });
    vi.mocked(studyRoomRepository.getRoomSprint).mockResolvedValueOnce({ sprint: mockSprint });

    const { result } = renderHook(() =>
      useRoomSprint({
        roomSlug: 'fireplace',
        initialSprint: mockSprint,
        canControlSprint: false,
      })
    );

    await act(async () => {
      await result.current.joinSprint();
    });
    expect(studyRoomRepository.joinRoomSprint).toHaveBeenCalledWith('fireplace', 'sprint-1');

    await act(async () => {
      await result.current.leaveSprint();
    });
    expect(studyRoomRepository.leaveRoomSprint).toHaveBeenCalledWith('fireplace', 'sprint-1');
  });

  it('subscribes to realtime channel and applies room.sprint.updated payload', () => {
    let subscriberCallback: ((data: unknown) => void) | undefined;
    mockSubscribe.mockImplementation((_channel: string, cb: (data: unknown) => void) => {
      subscriberCallback = cb;
      return vi.fn();
    });

    const { result } = renderHook(() =>
      useRoomSprint({
        roomSlug: 'fireplace',
        roomId: 'room-1',
        streamGeneration: 2,
        initialSprint: mockSprint,
      })
    );

    expect(mockSubscribe).toHaveBeenCalledWith('room:room-1:g2', expect.any(Function));

    const updatedSprint: RoomSprintSnapshotDTO = {
      ...mockSprint,
      status: 'PAUSED',
      remainingSeconds: 900,
      revision: 4,
    };

    act(() => {
      subscriberCallback?.({
        type: 'room.sprint.updated',
        payload: updatedSprint,
      });
    });

    expect(result.current.sprint?.status).toBe('PAUSED');
    expect(result.current.sprint?.remainingSeconds).toBe(900);
    expect(result.current.sprint?.revision).toBe(4);
  });
});
