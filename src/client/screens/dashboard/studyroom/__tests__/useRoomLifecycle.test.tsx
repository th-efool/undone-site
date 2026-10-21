/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRoomLifecycle } from '../hooks/useRoomLifecycle';

describe('useRoomLifecycle hook (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('joins room on mount when enabled and records generation and isJoined: true', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        roomId: 'room-1',
        generation: 1,
        lease: { leaseId: 'l-1', expiresAt: new Date().toISOString() },
      }),
    } as any);

    const { result } = renderHook(() =>
      useRoomLifecycle({ roomId: 'fireplace', enabled: true })
    );

    // Initial state before fetch resolves
    expect(result.current.isJoining).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isJoined).toBe(true);
    expect(result.current.generation).toBe(1);
    expect(result.current.error).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/studyroom',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"join"'),
      })
    );
  });

  it('captures failure reason and sets isJoined: false when join fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Room is at full capacity',
        code: 'ROOM_FULL',
      }),
    } as any);

    const { result } = renderHook(() =>
      useRoomLifecycle({ roomId: 'full-room', enabled: true })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isJoined).toBe(false);
    expect(result.current.error).toBe('Room is at full capacity');
  });

  it('sends leave request with tabId on explicit leave', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, generation: 1 }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, left: true }),
      } as any);

    const { result } = renderHook(() =>
      useRoomLifecycle({ roomId: 'fireplace', enabled: true })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isJoined).toBe(true);

    await act(async () => {
      await result.current.leave(true);
    });

    expect(result.current.isJoined).toBe(false);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/studyroom',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"leave"'),
      })
    );
  });
});
