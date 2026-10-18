// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlayback } from '../usePlayback';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('usePlayback fetch abort behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not get permanently stuck on isFetching=true when fetchChannelFeed is aborted', async () => {
    let fetchCount = 0;
    
    // We will store reject functions to simulate AbortError
    let resolveFetch2: ((value?: unknown) => void) | undefined = undefined;

    fetchMock.mockImplementation((url: string, options: { signal?: AbortSignal }) => {
      fetchCount++;
      if (fetchCount === 1) {
        // First fetch for 'default'
        return new Promise((resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              console.log('Abort event fired for fetch 1');
              const error = new Error('The user aborted a request.');
              error.name = 'AbortError';
              reject(error);
            });
            if (options.signal.aborted) {
              console.log('Signal 1 was already aborted');
              const error = new Error('The user aborted a request.');
              error.name = 'AbortError';
              reject(error);
            }
          }
        });
      } else if (fetchCount === 2) {
        // Second fetch for 'spark'
        return new Promise((resolve, reject) => {
          resolveFetch2 = resolve;
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              console.log('Abort event fired for fetch 2');
              const error = new Error('The user aborted a request.');
              error.name = 'AbortError';
              reject(error);
            });
            if (options.signal.aborted) {
              console.log('Signal 2 was already aborted');
              const error = new Error('The user aborted a request.');
              error.name = 'AbortError';
              reject(error);
            }
          }
        });
      } else if (fetchCount === 3) {
        // Third fetch for 'default'
        return Promise.resolve({ ok: true, json: async () => ({ items: [1, 2, 3, 4, 5, 6].map(i => ({ chunkId: i })) }) });
      } else {
        return Promise.resolve({ ok: true, json: async () => ({ items: [1, 2, 3, 4, 5, 6].map(i => ({ chunkId: i })) }) });
      }
    });

    console.log('Test start');
    const { result } = renderHook(() => usePlayback());

    console.log('Wait for initial fetch');
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    console.log('Fetch count:', fetchMock.mock.calls.length);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    console.log('Switch to spark');
    await act(async () => {
      result.current.setActiveChannel('spark');
    });

    console.log('Wait for effects');
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    console.log('Fetch count after spark:', fetchMock.mock.calls.length);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    console.log('Resolve spark fetch');
    if (resolveFetch2) {
      (resolveFetch2 as (v: unknown) => void)({ ok: true, json: async () => ({ items: [1, 2, 3, 4, 5, 6].map(i => ({ chunkId: i })) }) });
    }

    console.log('Switch to default');
    await act(async () => {
      result.current.setActiveChannel('default');
    });

    console.log('Wait for effects again');
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    // It should have called fetch a 3rd time!
    console.log(fetchMock.mock.calls.map((c) => c[0]));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});


describe('feed terminal states', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  it('settles an empty response without fetching forever', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.feedLoading).toBe(false));
    expect(result.current.activeItem).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.fetchChannelFeed('default', 0); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.feedLoading).toBe(false);
  });
  it('stops prefetch when the next page is empty', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ chunkId: 'last', lessonId: 'lesson', startSeconds: 0, endSeconds: 10 }] }) })
      .mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.feedLoading).toBe(false));
    expect(result.current.feedItems).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('exposes failure and clears it after explicit retry', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.feedError).toBe(true));
    expect(result.current.feedLoading).toBe(false);
    await act(async () => { await result.current.fetchChannelFeed('default', 0); });
    expect(result.current.feedError).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('lesson model labelling', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  it('correctly models seasonOrder, currentVideo, and totalVideos from feed data', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          chunkId: 'chunk-1',
          lessonId: 'lesson-1',
          lessonTitle: 'Introduction to Rust',
          chunkTitle: 'Ownership Model',
          seasonOrder: 2,
          lessonOrder: 3,
          totalLessonsInSeason: 10,
          totalVideos: 10,
          startSeconds: 0,
          endSeconds: 120,
        }],
      }),
    });
    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem).not.toBeNull());
    expect(result.current.lesson.seasonOrder).toBe(2);
    expect(result.current.lesson.seasonNumber).toBe(2);
    expect(result.current.lesson.currentVideo).toBe(3);
    expect(result.current.lesson.totalVideos).toBe(10);
  });
});
