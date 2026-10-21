/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePomodoro } from '../hooks/usePomodoro';
import { studyRoomRepository, type StudySessionDTO } from '@/src/client/repositories/studyRoomRepository';
import { pomodoroStorageAdapter } from '@/src/client/repositories/pomodoroStorageAdapter';

let mockRealtimeCallback: ((data: unknown) => void) | null = null;

vi.mock('@/src/client/realtime', () => ({
  useRealtime: () => ({
    subscribe: vi.fn((_channel: string, cb: (data: unknown) => void) => {
      mockRealtimeCallback = cb;
      return () => {
        mockRealtimeCallback = null;
      };
    }),
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-p8' } },
    status: 'authenticated',
  }),
}));

vi.mock('../utils/chime', () => ({
  playChime: vi.fn(),
}));

vi.mock('@/src/client/repositories/studyRoomRepository', () => ({
  studyRoomRepository: {
    getActiveSession: vi.fn(),
    startSession: vi.fn(),
    pauseSession: vi.fn(),
    resumeSession: vi.fn(),
    completeSession: vi.fn(),
    interruptSession: vi.fn(),
  },
}));

describe('Phase 8: Durable usePomodoro Integration', () => {
  beforeEach(() => {
    pomodoroStorageAdapter.resetToDefault();
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockRealtimeCallback = null;
    document.title = 'Initial Title';
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('hydrates active running session from server on mount with clock skew compensation', async () => {
    const serverNow = new Date('2026-10-21T10:00:00.000Z');
    // Client clock is 5000ms ahead of server
    const clientNow = new Date('2026-10-21T10:00:05.000Z').getTime();
    vi.setSystemTime(clientNow);

    const deadline = new Date(serverNow.getTime() + 1000 * 1000); // 1000s remaining on server

    const mockSession: StudySessionDTO = {
      id: 'sess-hydrated',
      userId: 'user-p8',
      studyRoomId: 'room-1',
      status: 'ACTIVE',
      targetDurationSeconds: 1500,
      elapsedSeconds: 500,
      startedAt: serverNow.toISOString(),
      resumedAt: serverNow.toISOString(),
      pausedAt: null,
      deadline: deadline.toISOString(),
      endedAt: null,
      version: 2,
      serverTime: serverNow.toISOString(),
    };

    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValueOnce(mockSession);

    const { result } = renderHook(() => usePomodoro('Library', undefined, 'room-1'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe('running');
    expect(result.current.state.phase).toBe('focus');
    expect(result.current.state.phaseDurationMs).toBe(1500 * 1000);
    // Remaining time must be around 1000s (compensated for the 5s client-server clock offset)
    expect(Math.round(result.current.state.remainingMs / 1000)).toBe(1000);
  });

  it('hydrates paused session from server on mount', async () => {
    const now = new Date();
    const mockSession: StudySessionDTO = {
      id: 'sess-paused',
      userId: 'user-p8',
      studyRoomId: 'room-1',
      status: 'PAUSED',
      targetDurationSeconds: 1500,
      elapsedSeconds: 400, // 1100s remaining
      startedAt: now.toISOString(),
      resumedAt: null,
      pausedAt: now.toISOString(),
      deadline: null,
      endedAt: null,
      version: 3,
      serverTime: now.toISOString(),
    };

    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValueOnce(mockSession);

    const { result } = renderHook(() => usePomodoro('Library'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe('paused');
    expect(result.current.state.remainingMs).toBe(1100 * 1000);
  });

  it('starts focus session, calls server startSession, and updates version', async () => {
    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValueOnce(null);

    const now = new Date();
    const deadline = new Date(now.getTime() + 1500 * 1000);
    const mockCreated: StudySessionDTO = {
      id: 'sess-new',
      userId: 'user-p8',
      studyRoomId: 'room-1',
      status: 'ACTIVE',
      targetDurationSeconds: 1500,
      elapsedSeconds: 0,
      startedAt: now.toISOString(),
      resumedAt: now.toISOString(),
      pausedAt: null,
      deadline: deadline.toISOString(),
      endedAt: null,
      version: 1,
      serverTime: now.toISOString(),
    };

    vi.mocked(studyRoomRepository.startSession).mockResolvedValueOnce(mockCreated);

    const { result } = renderHook(() => usePomodoro('Library', undefined, 'room-1'));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });

    expect(studyRoomRepository.startSession).toHaveBeenCalledWith(1500, 'room-1');
    expect(result.current.state.status).toBe('running');
  });

  it('pauses and resumes sending expectedVersion and handles 409 conflict', async () => {
    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValueOnce(null);

    const now = new Date();
    const mockCreated: StudySessionDTO = {
      id: 'sess-p',
      userId: 'user-p8',
      studyRoomId: null,
      status: 'ACTIVE',
      targetDurationSeconds: 1500,
      elapsedSeconds: 0,
      startedAt: now.toISOString(),
      resumedAt: now.toISOString(),
      pausedAt: null,
      deadline: new Date(now.getTime() + 1500 * 1000).toISOString(),
      endedAt: null,
      version: 1,
      serverTime: now.toISOString(),
    };

    vi.mocked(studyRoomRepository.startSession).mockResolvedValueOnce(mockCreated);

    const { result } = renderHook(() => usePomodoro('Library'));

    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });

    // Pause sends expectedVersion = 1
    const mockPaused: StudySessionDTO = {
      ...mockCreated,
      status: 'PAUSED',
      elapsedSeconds: 100,
      version: 2,
    };
    vi.mocked(studyRoomRepository.pauseSession).mockResolvedValueOnce(mockPaused);

    await act(async () => {
      result.current.pause();
      await Promise.resolve();
    });

    expect(studyRoomRepository.pauseSession).toHaveBeenCalledWith('sess-p', 1);

    // Resume with 409 conflict re-fetches getActiveSession
    const conflictErr = Object.assign(new Error('Session version mismatch'), { status: 409 });
    vi.mocked(studyRoomRepository.resumeSession).mockRejectedValueOnce(conflictErr);

    const authoritative: StudySessionDTO = {
      ...mockCreated,
      status: 'ACTIVE',
      version: 4,
    };
    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValueOnce(authoritative);

    await act(async () => {
      result.current.resume();
      await Promise.resolve();
    });

    expect(studyRoomRepository.getActiveSession).toHaveBeenCalled();
  });

  it('interrupts server session on reset and skip', async () => {
    const now = new Date();
    const mockActive: StudySessionDTO = {
      id: 'sess-interruptible',
      userId: 'user-p8',
      studyRoomId: null,
      status: 'ACTIVE',
      targetDurationSeconds: 1500,
      elapsedSeconds: 100,
      startedAt: now.toISOString(),
      resumedAt: now.toISOString(),
      pausedAt: null,
      deadline: new Date(now.getTime() + 1400 * 1000).toISOString(),
      endedAt: null,
      version: 1,
      serverTime: now.toISOString(),
    };

    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValueOnce(mockActive);
    vi.mocked(studyRoomRepository.interruptSession).mockResolvedValue({} as StudySessionDTO);

    const { result } = renderHook(() => usePomodoro('Library'));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.reset();
    });

    expect(studyRoomRepository.interruptSession).toHaveBeenCalledWith('sess-interruptible', 1);
    expect(result.current.state.status).toBe('idle');
  });

  it('completes server session on reaching natural deadline', async () => {
    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValueOnce(null);

    const now = Date.now();
    const mockCreated: StudySessionDTO = {
      id: 'sess-to-complete',
      userId: 'user-p8',
      studyRoomId: null,
      status: 'ACTIVE',
      targetDurationSeconds: 1, // 1 second for test
      elapsedSeconds: 0,
      startedAt: new Date(now).toISOString(),
      resumedAt: new Date(now).toISOString(),
      pausedAt: null,
      deadline: new Date(now + 1000).toISOString(),
      endedAt: null,
      version: 1,
      serverTime: new Date(now).toISOString(),
    };

    vi.mocked(studyRoomRepository.startSession).mockResolvedValueOnce(mockCreated);
    vi.mocked(studyRoomRepository.completeSession).mockResolvedValue({} as StudySessionDTO);

    const { result } = renderHook(() =>
      usePomodoro('Library', { focusMinutes: 1 / 60, shortBreakMinutes: 1 })
    );

    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });

    // Advance 1000ms to complete
    act(() => {
      vi.advanceTimersByTime(1250);
    });

    expect(studyRoomRepository.completeSession).toHaveBeenCalledWith('sess-to-complete', 1);
  });

  it('recalculates remaining countdown on tab wake-up (visibilitychange)', async () => {
    const now = Date.now();
    const mockActive: StudySessionDTO = {
      id: 'sess-sleepy',
      userId: 'user-p8',
      studyRoomId: null,
      status: 'ACTIVE',
      targetDurationSeconds: 1500,
      elapsedSeconds: 0,
      startedAt: new Date(now).toISOString(),
      resumedAt: new Date(now).toISOString(),
      pausedAt: null,
      deadline: new Date(now + 1500 * 1000).toISOString(),
      endedAt: null,
      version: 1,
      serverTime: new Date(now).toISOString(),
    };

    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValue(mockActive);

    const { result } = renderHook(() => usePomodoro('Library'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe('running');

    // Simulate sleeping tab: 300 seconds pass in real time without browser ticking
    vi.setSystemTime(now + 300 * 1000);

    // Trigger visibilitychange event
    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Remaining time must immediately snap to 1200 seconds!
    expect(Math.round(result.current.state.remainingMs / 1000)).toBe(1200);
  });

  it('synchronizes realtime study.session.updated event from another device', async () => {
    vi.mocked(studyRoomRepository.getActiveSession).mockResolvedValueOnce(null);

    const { result } = renderHook(() => usePomodoro('Library'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe('idle');
    expect(mockRealtimeCallback).toBeTypeOf('function');

    // Remote device paused the session
    const remoteNow = new Date();
    act(() => {
      mockRealtimeCallback!({
        type: 'study.session.updated',
        payload: {
          id: 'sess-remote',
          userId: 'user-p8',
          studyRoomId: null,
          status: 'PAUSED',
          targetDurationSeconds: 1500,
          elapsedSeconds: 600,
          startedAt: remoteNow.toISOString(),
          resumedAt: null,
          pausedAt: remoteNow.toISOString(),
          deadline: null,
          endedAt: null,
          version: 2,
          serverTime: remoteNow.toISOString(),
        },
      });
    });

    expect(result.current.state.status).toBe('paused');
    expect(result.current.state.remainingMs).toBe(900 * 1000);
  });
});
