// @vitest-environment jsdom
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAssistantActivity } from '../useAssistantActivity';

const mockState = {
  workspaceId: 'ws-100',
  sequence: 1,
};

vi.mock('@/src/client/interaction/hooks', () => ({
  useInteractionState: () => mockState,
}));

describe('useAssistantActivity', () => {
  const originalVisibilityState = document.visibilityState;
  let fetchMock: ReturnType<typeof vi.fn>;

  const setDocumentVisibility = (visibility: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', {
      value: visibility,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockState.workspaceId = 'ws-100';
    mockState.sequence = 1;
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      value: originalVisibilityState,
      writable: true,
      configurable: true,
    });
  });

  it('performs initial fetch, populates turns, sets unavailable to false, and records ETag', async () => {
    const turnsData = [{ messageId: 'msg-1', runId: 'run-1', status: 'completed' }];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ ETag: '"etag-v1"' }),
      json: async () => ({ turns: turnsData }),
    });

    const { result } = renderHook(() => useAssistantActivity());

    // Flush microtasks for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cohort-builder/workspaces/ws-100/activity',
      expect.objectContaining({
        cache: 'no-store',
        headers: {},
      })
    );
    expect(result.current.turns).toEqual(turnsData);
    expect(result.current.unavailable).toBe(false);
  });

  it('skips fetch when document.visibilityState is hidden on mount', async () => {
    setDocumentVisibility('hidden');

    const { result } = renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.turns).toEqual([]);
    expect(result.current.unavailable).toBe(false);
  });

  it('resumes and triggers immediate refresh when visibility changes to visible', async () => {
    setDocumentVisibility('hidden');

    const turnsData = [{ messageId: 'msg-vis', runId: 'run-vis', status: 'completed' }];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ ETag: '"etag-vis"' }),
      json: async () => ({ turns: turnsData }),
    });

    const { result } = renderHook(() => useAssistantActivity());

    expect(fetchMock).not.toHaveBeenCalled();

    // Tab becomes visible
    await act(async () => {
      setDocumentVisibility('visible');
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.turns).toEqual(turnsData);
  });

  it('handles HTTP 304 Not Modified without re-rendering or re-parsing JSON', async () => {
    const initialTurns = [{ messageId: 'msg-1', runId: 'run-1', status: 'running' }];
    const jsonParserMock = vi.fn();

    // 1st fetch: 200 OK with ETag
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ ETag: '"etag-initial"' }),
      json: async () => ({ turns: initialTurns }),
    });

    // 2nd fetch: 304 Not Modified
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 304,
      headers: new Headers({ ETag: '"etag-initial"' }),
      json: jsonParserMock,
    });

    const { result } = renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.turns).toEqual(initialTurns);

    // Active run polls in 2000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/cohort-builder/workspaces/ws-100/activity',
      expect.objectContaining({
        headers: {
          'If-None-Match': '"etag-initial"',
        },
      })
    );

    // Verify json parsing was bypassed and turns remain unchanged
    expect(jsonParserMock).not.toHaveBeenCalled();
    expect(result.current.turns).toEqual(initialTurns);
    expect(result.current.unavailable).toBe(false);
  });

  it('uses 2000ms polling interval when a turn has active status (pending or running)', async () => {
    const runningTurn = [{ messageId: 'msg-run', runId: 'run-active', status: 'running' }];
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ ETag: '"etag-running"' }),
      json: async () => ({ turns: runningTurn }),
    });

    renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // At 1999ms, no new poll yet
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // At 2000ms, second poll executes
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses 2000ms polling interval when a turn is pending', async () => {
    const pendingTurn = [{ messageId: 'msg-pend', runId: 'run-pending', status: 'pending' }];
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ ETag: '"etag-pending"' }),
      json: async () => ({ turns: pendingTurn }),
    });

    renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance 2000ms -> second poll triggers
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('backs off to 20000ms polling interval when turns are idle or completed', async () => {
    const completedTurn = [{ messageId: 'msg-done', runId: 'run-done', status: 'completed' }];
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ ETag: '"etag-done"' }),
      json: async () => ({ turns: completedTurn }),
    });

    renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // At 2000ms, should NOT have polled again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // At 19999ms, still should NOT have polled again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(17999);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // At 20000ms, backed-off poll fires!
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('handles fetch errors by setting unavailable to true', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.unavailable).toBe(true);
    expect(result.current.turns).toEqual([]);
  });

  it('handles non-200 non-304 responses by setting unavailable to true', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({ error: 'Internal Error' }),
    });

    const { result } = renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.unavailable).toBe(true);
  });

  it('cancels scheduled timers when tab becomes hidden and prevents background requests', async () => {
    const idleTurn = [{ messageId: 'msg-1', runId: null, status: 'completed' }];
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ turns: idleTurn }),
    });

    renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Tab is hidden before 20s poll expires
    await act(async () => {
      setDocumentVisibility('hidden');
    });

    // Advance past the 20s interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25000);
    });

    // Should NOT have polled while hidden!
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-runs immediately when state.sequence changes (e.g. user sends message)', async () => {
    const turn1 = [{ messageId: 'm-1', runId: 'r-1', status: 'completed' }];
    const turn2 = [
      { messageId: 'm-1', runId: 'r-1', status: 'completed' },
      { messageId: 'm-2', runId: 'r-2', status: 'pending' },
    ];

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: '"e-1"' }),
        json: async () => ({ turns: turn1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: '"e-2"' }),
        json: async () => ({ turns: turn2 }),
      });

    const { result, rerender } = renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.turns).toEqual(turn1);

    // User sends a new message -> sequence increments
    mockState.sequence = 2;
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    // An instant refresh was triggered
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.turns).toEqual(turn2);
  });

  it('cleans up timers and abort controller on unmount', async () => {
    let abortSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, init) => {
      abortSignal = init.signal;
      return new Promise(() => {}); // never resolves
    });

    const { unmount } = renderHook(() => useAssistantActivity());

    expect(abortSignal?.aborted).toBe(false);

    unmount();

    expect(abortSignal?.aborted).toBe(true);
  });

  it('resets ETag when switching workspaces so old ETag is not sent to new workspace', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: '"etag-ws1"' }),
        json: async () => ({ turns: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: '"etag-ws2"' }),
        json: async () => ({ turns: [] }),
      });

    const { rerender } = renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Switch to different workspace
    mockState.workspaceId = 'ws-200';
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Crucial: The second fetch must NOT send ws-1's ETag!
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/cohort-builder/workspaces/ws-200/activity',
      expect.objectContaining({
        headers: {},
      })
    );
  });

  it('skips fetch when workspaceId is missing or empty', async () => {
    mockState.workspaceId = '';

    renderHook(() => useAssistantActivity());

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maintains active 2s polling interval after receiving HTTP 304 while a run is active', async () => {
    const runningTurn = [{ messageId: 'm-run', runId: 'r-1', status: 'running' }];

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: '"etag-run-1"' }),
        json: async () => ({ turns: runningTurn }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 304,
        headers: new Headers({ ETag: '"etag-run-1"' }),
        json: vi.fn(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: '"etag-run-2"' }),
        json: async () => ({ turns: [{ messageId: 'm-run', runId: 'r-1', status: 'completed' }] }),
      });

    renderHook(() => useAssistantActivity());

    // 1st fetch (initial)
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2nd fetch (after 2s, returns 304)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 3rd fetch (should also fire after 2s because run was active)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
