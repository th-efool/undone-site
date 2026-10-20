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
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ cohortId: 'one', isPaused: false, pausedUntil: null });
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
  it('cleans up pending reorder and debounce timers on unmount', async () => {
    vi.useFakeTimers();
    const second = { ...cohort, id: 'two', rank: 2 };
    const props = { activeCohorts: [cohort, second], continueLater: [] };
    const { result, unmount } = renderHook(() => useHome(props));

    act(() => {
      result.current.actions.moveCohort('one', 'two');
      result.current.actions.saveSchedule('one', ['Tue']);
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});
