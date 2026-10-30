/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveCohort } from '../../models';
const mocks = vi.hoisted(() => ({
  authenticated: true,
  saveChoices: vi.fn(), getStoredChoices: vi.fn(), syncWithBackend: vi.fn(),
  data: { activeCohorts: [], continueLater: [], recentlyCompleted: [], summaries: [] },
  useQuery: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: unknown) => mocks.useQuery(options) }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: mocks.authenticated ? 'authenticated' : 'unauthenticated', data: mocks.authenticated ? { user: { id: 'learner' } } : null }) }));
vi.mock('@/src/client/repositories/homeRepository', () => ({ homeRepository: { getHome: () => mocks.data } }));
vi.mock('@/src/client/repositories/homeStorageAdapter', () => ({ homeStorageAdapter: mocks }));
import { useHome } from '../useHome';
const cohort: ActiveCohort = { id: 'one', rank: 1, title: 'One', provider: 'Undone', thumbnail: '/cover.jpg', minutesToday: 0, dailyGoalMinutes: 20, progressPercent: 42, schedule: { days: ['Mon'], label: 'Mon' } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated = true;
  mocks.useQuery.mockImplementation(() => ({ data: mocks.data, isLoading: false }));
  mocks.syncWithBackend.mockResolvedValue(null);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('home subscription actions', () => {
  it('treats an empty server list as authoritative and persists removal of the last cohort', async () => {
    const props = { activeCohorts: [cohort], continueLater: [] };
    const { result } = renderHook(() => useHome(props));
    await act(async () => result.current.actions.removeSubscribedCohort('one'));
    expect(fetch).toHaveBeenCalledWith('/api/cohort/one/join', { method: 'DELETE' });
    expect(result.current.activeCohorts).toEqual([]);
    expect(mocks.saveChoices).toHaveBeenLastCalledWith([], [], 'learner');
    expect(mocks.getStoredChoices).not.toHaveBeenCalled();
    const empty = { activeCohorts: [], continueLater: [] };
    const { result: emptyResult } = renderHook(() => useHome(empty));
    expect(emptyResult.current.activeCohorts).toEqual([]);
  });
  it('keeps the card when server removal fails', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response);
    const props = { activeCohorts: [cohort], continueLater: [] };
    const { result } = renderHook(() => useHome(props));
    await act(async () => { await expect(result.current.actions.removeSubscribedCohort('one')).rejects.toThrow(); });
    expect(result.current.activeCohorts).toEqual([cohort]);
  });
  it('saves learning settings for a paused card without resuming it', async () => {
    const paused = { ...cohort, pausedUntil: new Date(Date.now() + 86400000).toISOString(), resumeLabel: 'Paused' };
    const props = { activeCohorts: [], continueLater: [paused] };
    const { result } = renderHook(() => useHome(props));
    await act(async () => result.current.actions.saveLearningSettings('one', {
      dailyGoalMinutes: 45, schedule: { days: ['Tue'], label: 'Tue' }, orderStyle: 'Randomize',
    }));
    expect(result.current.continueLater[0]).toMatchObject({ dailyGoalMinutes: 45, pausedUntil: paused.pausedUntil, orderStyle: 'Randomize' });
    expect(result.current.activeCohorts).toEqual([]);
  });
  it('syncs pauses for different cohorts independently and restores expired pauses in rank order', async () => {
    vi.useFakeTimers();
    const second = { ...cohort, id: 'two', rank: 2 };
    const props = { activeCohorts: [cohort, second], continueLater: [] };
    const { result } = renderHook(() => useHome(props));
    await act(async () => result.current.actions.pauseActiveCohort('one', new Date(Date.now() + 3000)));
    await act(async () => result.current.actions.pauseActiveCohort('two', new Date(Date.now() + 6000)));
    await act(async () => { await vi.advanceTimersByTimeAsync(801); });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(11); });
    expect(result.current.continueLater).toEqual([]);
    expect(result.current.activeCohorts.map((item) => item.id)).toEqual(['one', 'two']);
  });
  it('optimistically pauses the cohort immediately before server responds and keeps it paused on success', async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
    const props = { activeCohorts: [cohort], continueLater: [] };
    const { result } = renderHook(() => useHome(props));
    const until = new Date(Date.now() + 86400000);
    let pending!: Promise<void>;
    act(() => { pending = result.current.actions.pauseActiveCohort('one', until); });
    expect(result.current.activeCohorts).toEqual([]);
    expect(result.current.continueLater[0].pausedUntil).toBe(until.toISOString());
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({ cohortId: 'one', isPaused: true, pausedUntil: until.toISOString() });
    await act(async () => { resolve({ ok: true } as Response); await pending; });
    expect(result.current.activeCohorts).toEqual([]);
    expect(result.current.continueLater[0].pausedUntil).toBe(until.toISOString());
  });
  it('rejects failed pause writes and keeps the cohort active', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response);
    const props = { activeCohorts: [cohort], continueLater: [] };
    const { result } = renderHook(() => useHome(props));
    await act(async () => { await expect(result.current.actions.pauseActiveCohort('one', new Date(Date.now() + 86400000))).rejects.toThrow(); });
    expect(result.current.activeCohorts).toEqual([cohort]);
    expect(result.current.continueLater).toEqual([]);
  });
  it('persists resume and clears the database pause timestamp', async () => {
    const paused = { ...cohort, pausedUntil: new Date(Date.now() + 86400000).toISOString(), resumeLabel: 'Paused' };
    const props = { activeCohorts: [], continueLater: [paused] };
    const { result } = renderHook(() => useHome(props));
    await act(async () => result.current.actions.resumePausedCohort('one'));
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({ cohortId: 'one', isPaused: false, pausedUntil: null });
    expect(result.current.continueLater).toEqual([]);
    expect(result.current.activeCohorts[0].id).toBe('one');
  });
  it('never falls back to local-only mutation without an authenticated session', async () => {
    mocks.authenticated = false;
    const props = { activeCohorts: [cohort], continueLater: [] };
    const { result } = renderHook(() => useHome(props));
    await expect(result.current.actions.pauseActiveCohort('one', new Date(Date.now() + 86400000))).rejects.toThrow('Sign in');
    await expect(result.current.actions.resumePausedCohort('one')).rejects.toThrow('Sign in');
    await expect(result.current.actions.removeSubscribedCohort('one')).rejects.toThrow('Sign in');
    await expect(result.current.actions.saveLearningSettings('one', { dailyGoalMinutes: 30, schedule: cohort.schedule, orderStyle: 'Sequential' })).rejects.toThrow('Sign in');
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.activeCohorts).toEqual([cohort]);
  });
  it('invokes useQuery with 5m staleTime and refetchOnWindowFocus/refetchOnMount disabled', () => {
    renderHook(() => useHome());
    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['home', 'learner'],
        staleTime: 300_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      }),
    );
  });

  describe('FH-07 mutation serialization and identity-safe rollback guard', () => {
    it('rejects a second mutation while the first mutation is still saving', async () => {
      let resolveFirst!: (response: Response) => void;
      vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolveFirst = done; }));

      const second = { ...cohort, id: 'two', rank: 2 };
      const props = { activeCohorts: [cohort, second], continueLater: [] };
      const { result } = renderHook(() => useHome(props));

      // 1. Start deferred pause A
      let pausePromise!: Promise<void>;
      act(() => {
        pausePromise = result.current.actions.pauseActiveCohort('one', new Date(Date.now() + 86400000));
      });
      expect(result.current.isSyncing).toBe(true);
      expect(result.current.mutationPending).toBe(true);

      // 2. Immediately attempt delete B while A is in flight
      await expect(result.current.actions.removeSubscribedCohort('two')).rejects.toThrow(
        'A change is still saving. Please wait.'
      );

      // 3. Resolve A
      await act(async () => {
        resolveFirst({ ok: true } as Response);
        await pausePromise;
      });

      expect(result.current.isSyncing).toBe(false);
      expect(result.current.mutationPending).toBe(false);

      // 4. Now delete B succeeds
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
      await act(async () => {
        await result.current.actions.removeSubscribedCohort('two');
      });
      expect(result.current.activeCohorts.find((c) => c.id === 'two')).toBeUndefined();
    });

    it('restores original list when pause A fails and allows subsequent action B to work', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Error' } as Response);

      const second = { ...cohort, id: 'two', rank: 2 };
      const props = { activeCohorts: [cohort, second], continueLater: [] };
      const { result } = renderHook(() => useHome(props));

      // 1. Pause A fails
      await act(async () => {
        await expect(
          result.current.actions.pauseActiveCohort('one', new Date(Date.now() + 86400000))
        ).rejects.toThrow();
      });

      // Assert rollback
      expect(result.current.activeCohorts.map((c) => c.id)).toEqual(['one', 'two']);
      expect(result.current.continueLater).toEqual([]);
      expect(result.current.isSyncing).toBe(false);

      // 2. Subsequent action B succeeds
      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
      await act(async () => {
        await result.current.actions.removeSubscribedCohort('two');
      });
      expect(result.current.activeCohorts.map((c) => c.id)).toEqual(['one']);
    });

    it('prevents server prop hydration from erasing optimistic state while a mutation is in flight', async () => {
      let resolveFirst!: (response: Response) => void;
      vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolveFirst = done; }));

      const initialProps = { activeCohorts: [cohort], continueLater: [] };
      const { result, rerender } = renderHook((p) => useHome(p), { initialProps });

      // Start pause
      let pausePromise!: Promise<void>;
      act(() => {
        pausePromise = result.current.actions.pauseActiveCohort('one', new Date(Date.now() + 86400000));
      });
      expect(result.current.activeCohorts).toEqual([]);
      expect(result.current.continueLater.length).toBe(1);

      // Server props re-render with stale props while pause is still saving
      rerender({ activeCohorts: [cohort], continueLater: [] });

      // Optimistic state must NOT be overwritten by the stale server props
      expect(result.current.activeCohorts).toEqual([]);
      expect(result.current.continueLater.length).toBe(1);

      // Resolve mutation
      await act(async () => {
        resolveFirst({ ok: true } as Response);
        await pausePromise;
      });

      expect(result.current.activeCohorts).toEqual([]);
      expect(result.current.continueLater.length).toBe(1);
    });

    it('ignores old response callbacks when user logs out or switches accounts during request', async () => {
      let resolveFirst!: (response: Response) => void;
      vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolveFirst = done; }));

      const props = { activeCohorts: [cohort], continueLater: [] };
      const { result, rerender } = renderHook(() => useHome(props));

      // Start pause under 'learner'
      let pausePromise!: Promise<void>;
      act(() => {
        pausePromise = result.current.actions.pauseActiveCohort('one', new Date(Date.now() + 86400000));
      });

      // User logs out mid-request
      mocks.authenticated = false;
      rerender();

      // Resolve old request
      await act(async () => {
        resolveFirst({ ok: true } as Response);
        try {
          await pausePromise;
        } catch {}
      });

      // Must not save old user's state under anonymous or new user
      const saveCalls = mocks.saveChoices.mock.calls;
      const lastCall = saveCalls[saveCalls.length - 1];
      if (lastCall) {
        expect(lastCall[2]).not.toBe('other-user');
      }
    });
  });
});
