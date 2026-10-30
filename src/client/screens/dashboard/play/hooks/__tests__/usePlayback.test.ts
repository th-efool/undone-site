// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlayback } from '../usePlayback';

const nav = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.searchParams,
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('usePlayback fetch abort behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    nav.searchParams = new URLSearchParams();
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

  it('does not trigger infinite abort recursion or exceed maximum update depth when superseded', async () => {
    let callCount = 0;
    fetchMock.mockImplementation((_url: string, options: { signal?: AbortSignal }) => {
      callCount++;
      return new Promise((resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const error = new Error('The user aborted a request.');
            error.name = 'AbortError';
            reject(error);
          });
        }
        if (callCount === 2) {
          setTimeout(() => {
            resolve({ ok: true, json: async () => ({ items: [{ chunkId: 'c1' }] }) });
          }, 20);
        } else if (callCount > 2) {
          resolve({ ok: true, json: async () => ({ items: [] }) });
        }
      });
    });

    const { result } = renderHook(() => usePlayback());

    // Trigger rapid superseding fetch for the same channel
    await act(async () => {
      void result.current.fetchChannelFeed('default', 0);
    });

    // Wait for resolution
    await waitFor(() => {
      expect(result.current.feedLoading).toBe(false);
    });

    expect(result.current.feedItems).toHaveLength(1);
    expect(callCount).toBeLessThan(5);
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
  it('handles network TypeError (Failed to fetch) on initial or prefetch without infinite loops', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.feedError).toBe(true));
    expect(result.current.feedLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('stops prefetching if subsequent pages return only duplicate chunkIds', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ chunkId: 'only-one', lessonId: 'l1', startSeconds: 0, endSeconds: 60 }] }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ items: [{ chunkId: 'only-one', lessonId: 'l1', startSeconds: 0, endSeconds: 60 }] }),
      });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.feedLoading).toBe(false));
    expect(result.current.feedItems).toHaveLength(1);
    // Must not keep fetching page 2, 3, ... 100 in a loop
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

describe('completeActiveChunk feed advance (ISSUE-2)', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('smoothly advances to the next chunk without rewinding or refetching page 0', async () => {
    const chunkA = {
      chunkId: 'chunk-A',
      lessonId: 'lesson-1',
      lessonTitle: 'Lesson 1',
      chunkTitle: 'Chunk A',
      seasonOrder: 1,
      lessonOrder: 1,
      totalLessonsInSeason: 5,
      totalVideos: 5,
      startSeconds: 0,
      endSeconds: 60,
    };
    const chunkB = {
      chunkId: 'chunk-B',
      lessonId: 'lesson-1',
      lessonTitle: 'Lesson 1',
      chunkTitle: 'Chunk B',
      seasonOrder: 1,
      lessonOrder: 1,
      totalLessonsInSeason: 5,
      totalVideos: 5,
      startSeconds: 60,
      endSeconds: 120,
    };
    const chunkC = {
      chunkId: 'chunk-C',
      lessonId: 'lesson-2',
      lessonTitle: 'Lesson 2',
      chunkTitle: 'Chunk C',
      seasonOrder: 1,
      lessonOrder: 2,
      totalLessonsInSeason: 5,
      totalVideos: 5,
      startSeconds: 0,
      endSeconds: 180,
    };
    const chunkD = {
      chunkId: 'chunk-D',
      lessonId: 'lesson-2',
      lessonTitle: 'Lesson 2',
      chunkTitle: 'Chunk D',
      seasonOrder: 1,
      lessonOrder: 2,
      totalLessonsInSeason: 5,
      totalVideos: 5,
      startSeconds: 180,
      endSeconds: 300,
    };

    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/progress/chunk')) {
        return { ok: true, json: async () => ({ success: true, progress: { chunkId: 'chunk-A', status: 'COMPLETED' } }) };
      }
      if (typeof url === 'string' && url.includes('/api/feed')) {
        return { ok: true, json: async () => ({ items: [chunkA, chunkB, chunkC, chunkD] }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-A'));

    let success = false;
    await act(async () => {
      success = await result.current.completeActiveChunk();
    });

    expect(success).toBe(true);
    expect(result.current.activeItem?.chunkId).toBe('chunk-B');
    expect(result.current.feedItems.map(it => it.chunkId)).toEqual(['chunk-B', 'chunk-C', 'chunk-D']);

    const progressCalls = fetchMock.mock.calls.filter((c: any[]) => c[0] === '/api/progress/chunk');
    expect(progressCalls).toHaveLength(1);

    const feedCalls = fetchMock.mock.calls.filter((c: any[]) => typeof c[0] === 'string' && c[0].includes('/api/feed'));
    expect(feedCalls).toHaveLength(1);
  });

  it('triggers next page prefetch and clamps index when remaining items become low', async () => {
    const chunkLast = {
      chunkId: 'chunk-solo',
      lessonId: 'lesson-1',
      lessonTitle: 'Lesson 1',
      chunkTitle: 'Chunk Solo',
      seasonOrder: 1,
      lessonOrder: 1,
      totalLessonsInSeason: 1,
      totalVideos: 1,
      startSeconds: 0,
      endSeconds: 60,
    };
    const chunkNextPage = {
      chunkId: 'chunk-next-page',
      lessonId: 'lesson-2',
      lessonTitle: 'Lesson 2',
      chunkTitle: 'Next Page Chunk',
      seasonOrder: 1,
      lessonOrder: 2,
      totalLessonsInSeason: 1,
      totalVideos: 1,
      startSeconds: 0,
      endSeconds: 60,
    };

    fetchMock.mockImplementation(async (url: string, options?: any) => {
      if (typeof url === 'string' && url.includes('/api/progress/chunk')) {
        let chunkId = 'chunk-solo';
        try {
          const body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
          chunkId = body?.chunkId ?? body?.id ?? chunkId;
        } catch {}
        return { ok: true, json: async () => ({ success: true, progress: { chunkId, status: 'COMPLETED' } }) };
      }
      if (typeof url === 'string' && url.includes('/api/feed')) {
        let body: any = {};
        try {
          body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
        } catch {}
        const isContinuation = (body?.excludeChunkIds && body.excludeChunkIds.length > 0) || url.includes('pageIndex=1');
        if (!isContinuation) {
          return { ok: true, json: async () => ({ items: [chunkLast], hasMore: true }) };
        } else {
          return { ok: true, json: async () => ({ items: [chunkNextPage], hasMore: false }) };
        }
      }
      return { ok: true, json: async () => ({ items: [] }) };
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-solo'));

    let success = false;
    await act(async () => {
      success = await result.current.completeActiveChunk();
    });

    expect(success).toBe(true);

    // Wait for the background continuation prefetch to resolve and append
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-next-page'));
    expect(result.current.feedItems.map(it => it.chunkId)).toContain('chunk-next-page');

    const feedCalls = fetchMock.mock.calls.filter((c: any[]) => typeof c[0] === 'string' && c[0].includes('/api/feed'));
    expect(feedCalls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('dynamic player stats and daily goal (ISSUE-3)', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('initializes with 0 safe defaults when feed is empty', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.feedLoading).toBe(false));
    expect(result.current.dailyGoalPercent).toBe(0);
    expect(result.current.stats).toEqual({
      cohortsCovered: 0,
      chunksRemaining: 0,
      estimatedMinutes: 0,
    });
  });

  it('dynamically computes cohortsCovered, chunksRemaining, and estimatedMinutes from feed items', async () => {
    const chunk1 = {
      chunkId: 'c1',
      lessonId: 'l1',
      cohortId: 'cohort-alpha',
      startSeconds: 0,
      endSeconds: 120,
    };
    const chunk2 = {
      chunkId: 'c2',
      lessonId: 'l1',
      cohortId: 'cohort-alpha',
      startSeconds: 120,
      endSeconds: 300,
    };
    const chunk3 = {
      chunkId: 'c3',
      lessonId: 'l2',
      cohortId: 'cohort-beta',
      startSeconds: 0,
      endSeconds: 180,
    };

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [chunk1, chunk2, chunk3] }) });
    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.feedItems).toHaveLength(3));

    expect(result.current.stats.cohortsCovered).toBe(2);
    expect(result.current.stats.chunksRemaining).toBe(3);
    expect(result.current.stats.estimatedMinutes).toBe(8);
    expect(result.current.dailyGoalPercent).toBe(0);
  });

  it('updates dailyGoalPercent and decrements remaining stats when chunks are completed', async () => {
    const chunk1 = {
      chunkId: 'c1',
      lessonId: 'l1',
      cohortId: 'cohort-alpha',
      startSeconds: 0,
      endSeconds: 120,
    };
    const chunk2 = {
      chunkId: 'c2',
      lessonId: 'l1',
      cohortId: 'cohort-alpha',
      startSeconds: 120,
      endSeconds: 240,
    };

    fetchMock.mockImplementation(async (url: string, options?: any) => {
      if (typeof url === 'string' && url.includes('/api/progress/chunk')) {
        let chunkId = 'c1';
        try {
          const body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
          chunkId = body?.chunkId ?? body?.id ?? chunkId;
        } catch {}
        return { ok: true, json: async () => ({ success: true, progress: { chunkId, status: 'COMPLETED' } }) };
      }
      if (typeof url === 'string' && (url.includes('pageIndex=0') || url.includes('/api/feed'))) {
        let body: any = {};
        try {
          body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
        } catch {}
        if (body?.excludeChunkIds && body.excludeChunkIds.length > 0) {
          return { ok: true, json: async () => ({ items: [], hasMore: false }) };
        }
        return { ok: true, json: async () => ({ items: [chunk1, chunk2] }) };
      }
      return { ok: true, json: async () => ({ items: [] }) };
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.feedItems).toHaveLength(2));

    expect(result.current.stats.chunksRemaining).toBe(2);
    expect(result.current.dailyGoalPercent).toBe(0);

    await act(async () => {
      await result.current.completeActiveChunk();
    });

    expect(result.current.dailyGoalPercent).toBe(15);
    expect(result.current.stats.chunksRemaining).toBe(1);
    expect(result.current.stats.estimatedMinutes).toBe(2);
  });
});

describe('persisted player notes and bookmarks (ISSUE-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const chunkA = {
    chunkId: 'chunk-A',
    lessonId: 'lesson-1',
    lessonTitle: 'Rust Ownership',
    cohortId: 'cohort-1',
    startSeconds: 0,
    endSeconds: 120,
  };
  const chunkB = {
    chunkId: 'chunk-B',
    lessonId: 'lesson-1',
    lessonTitle: 'Rust Borrowing',
    cohortId: 'cohort-1',
    startSeconds: 120,
    endSeconds: 240,
  };

  it('persists notes across chunk navigation and syncs to workspace notes API', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/workspace/notes')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (typeof url === 'string' && (url.includes('pageIndex=0') || url.includes('/api/feed'))) {
        return { ok: true, json: async () => ({ items: [chunkA, chunkB] }) };
      }
      return { ok: true, json: async () => ({ items: [] }) };
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-A'));

    // Save note on chunk A
    await act(async () => {
      await result.current.saveNotes('Notes on chunk A');
    });

    expect(result.current.notesText).toBe('Notes on chunk A');
    expect(localStorage.getItem('sidequest_note_chunk-A')).toBe('Notes on chunk A');

    // Verify background workspace notes PATCH API call
    const notesPatchCalls = fetchMock.mock.calls.filter((c: any[]) => typeof c[0] === 'string' && c[0].includes('/api/workspace/notes'));
    expect(notesPatchCalls).toHaveLength(1);

    // Navigate to chunk B
    await act(async () => {
      result.current.goToIndex(1);
    });

    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-B'));
    expect(result.current.notesText).toBe('');

    // Navigate back to chunk A
    await act(async () => {
      result.current.goToIndex(0);
    });

    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-A'));
    expect(result.current.notesText).toBe('Notes on chunk A');
  });

  it('persists bookmarks across chunk navigation', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && (url.includes('pageIndex=0') || url.includes('/api/feed'))) {
        return { ok: true, json: async () => ({ items: [chunkA, chunkB] }) };
      }
      return { ok: true, json: async () => ({ items: [] }) };
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-A'));

    expect(result.current.bookmarked).toBe(false);

    // Toggle bookmark on chunk A
    act(() => {
      result.current.toggleBookmark();
    });

    expect(result.current.bookmarked).toBe(true);
    expect(localStorage.getItem('sidequest_bookmark_chunk-A')).toBe('true');

    // Navigate to chunk B
    await act(async () => {
      result.current.goToIndex(1);
    });

    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-B'));
    expect(result.current.bookmarked).toBe(false);

    // Navigate back to chunk A
    await act(async () => {
      result.current.goToIndex(0);
    });

    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-A'));
    expect(result.current.bookmarked).toBe(true);
  });

  it('resolves target lesson matching requested lessonId and 0/1-based lesson order', async () => {
    nav.searchParams = new URLSearchParams('cohort=test&lessonId=lesson-target');
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        items: [
          { chunkId: 'c1', lessonId: 'lesson-1', lessonOrder: 1, endSeconds: 60, startSeconds: 0 },
          { chunkId: 'c2', lessonId: 'lesson-target', lessonOrder: 2, endSeconds: 120, startSeconds: 60 },
        ],
      }),
    }));

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('c2'));
    expect(result.current.currentIndex).toBe(1);
  });

  it('resolves target lesson using 0-indexed fallback lesson order', async () => {
    nav.searchParams = new URLSearchParams('cohort=test&lesson=1');
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        items: [
          { chunkId: 'c0', lessonId: 'l0', lessonOrder: 0, endSeconds: 60, startSeconds: 0 },
          { chunkId: 'c1', lessonId: 'l1', lessonOrder: 1, endSeconds: 120, startSeconds: 60 },
        ],
      }),
    }));

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('c0'));
    expect(result.current.currentIndex).toBe(0);
  });
});

describe('playback foundations: exact navigation, media controls, and completion invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    nav.searchParams = new URLSearchParams();
  });

  const testItems = [
    { chunkId: 'c0', lessonId: 'l1', lessonTitle: 'L1', chunkTitle: 'C0', startSeconds: 0, endSeconds: 60, lessonType: 'video', lessonVideoUrl: 'https://cdn.example.com/v0.mp4' },
    { chunkId: 'c1', lessonId: 'l1', lessonTitle: 'L1', chunkTitle: 'C1', startSeconds: 60, endSeconds: 120, lessonType: 'video', lessonVideoUrl: 'https://cdn.example.com/v1.mp4' },
    { chunkId: 'c2', lessonId: 'l2', lessonTitle: 'L2', chunkTitle: 'C2', startSeconds: 0, endSeconds: 60, lessonType: 'video', lessonVideoUrl: 'https://cdn.example.com/v2.mp4' },
    { chunkId: 'c3', lessonId: 'l2', lessonTitle: 'L2', chunkTitle: 'C3', startSeconds: 60, endSeconds: 120, lessonType: 'video', lessonVideoUrl: 'https://cdn.example.com/v3.mp4' },
  ];

  it('navigates directly to exact index without intermediate stepping and does not mark items completed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: testItems }),
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('c0'));
    expect(result.current.currentIndex).toBe(0);

    // Exact jump from 0 to 3
    act(() => {
      result.current.goToIndex(3);
    });

    expect(result.current.currentIndex).toBe(3);
    expect(result.current.activeItem?.chunkId).toBe('c3');
    expect(result.current.activeItem?.chunkTitle).toBe('C3');

    // Preceding items must NOT be marked completed merely because they precede active item
    expect(result.current.itemStatuses).toEqual(['not-started', 'not-started', 'not-started', 'not-started']);
    expect(result.current.isChunkCompleted('c0')).toBe(false);
    expect(result.current.isChunkCompleted('c1')).toBe(false);

    // No progress calls were dispatched
    const progressCalls = fetchMock.mock.calls.filter((c: any[]) => typeof c[0] === 'string' && c[0].includes('/api/progress'));
    expect(progressCalls).toHaveLength(0);
  });

  it('binds direct HTML5 video element controls, speed, volume, and seeking', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: testItems }),
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('c0'));

    const mockVideo = document.createElement('video');
    mockVideo.play = vi.fn().mockImplementation(() => Promise.resolve());
    mockVideo.pause = vi.fn().mockImplementation(() => {});

    act(() => {
      result.current.registerVideoElement(mockVideo);
    });

    // Test volume
    act(() => {
      result.current.setVolume(70);
    });
    expect(mockVideo.volume).toBeCloseTo(0.7);
    expect(mockVideo.muted).toBe(false);

    // Test toggleMute: muting sets volume to 0 and muted to true
    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.muted).toBe(true);
    expect(result.current.volume).toBe(0);

    // Test toggleMute: unmuting restores prior audible volume (70)
    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.muted).toBe(false);
    expect(result.current.volume).toBe(70);
    expect(mockVideo.volume).toBeCloseTo(0.7);

    // Test playback speed
    act(() => {
      result.current.setPlaybackSpeed(1.5);
    });
    expect(mockVideo.playbackRate).toBe(1.5);

    // Test seeking (relative percent to chunk duration: startSeconds=0, endSeconds=60 -> 30s)
    act(() => {
      result.current.seekToPercent(50);
    });
    expect(mockVideo.currentTime).toBe(30);

    // Test play/pause toggle
    await act(async () => {
      result.current.togglePlayback();
    });
    expect(mockVideo.play).toHaveBeenCalled();

    // Directly simulate playback failure
    mockVideo.play = vi.fn().mockRejectedValueOnce(new Error('Playback failed'));
    act(() => {
      mockVideo.dispatchEvent(new Event('pause'));
    });

    await act(async () => {
      result.current.togglePlayback();
    });
    expect(result.current.mediaError).toBe('Playback could not be started.');
  });

  it('does not advance feed on completion failure and exposes error', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/progress/chunk')) {
        return { ok: false, status: 500 };
      }
      return { ok: true, json: async () => ({ items: testItems }) };
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('c0'));

    let success = true;
    await act(async () => {
      success = await result.current.completeActiveChunk();
    });

    expect(success).toBe(false);
    expect(result.current.completionError).toBeTruthy();
    // Invariant: feed must not advance or discard chunk when completion fails
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.activeItem?.chunkId).toBe('c0');
    expect(result.current.feedItems).toHaveLength(4);
  });

  it('preserves user focused chunk when completion resolves asynchronously after navigation', async () => {
    let resolveCompletion: (val: any) => void = () => {};
    const completionPromise = new Promise((resolve) => {
      resolveCompletion = resolve;
    });

    fetchMock.mockImplementation(async (url: string, options?: any) => {
      if (typeof url === 'string' && url.includes('/api/progress/chunk')) {
        await completionPromise;
        let chunkId = 'c0';
        try {
          const body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
          chunkId = body?.chunkId ?? body?.id ?? chunkId;
        } catch {}
        return { ok: true, json: async () => ({ success: true, progress: { chunkId, status: 'COMPLETED' } }) };
      }
      if (typeof url === 'string' && (url.includes('pageIndex=0') || url.includes('/api/feed'))) {
        let body: any = {};
        try {
          body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
        } catch {}
        if (body?.excludeChunkIds && body.excludeChunkIds.length > 0) {
          const excluded = new Set(body.excludeChunkIds);
          return { ok: true, json: async () => ({ items: testItems.filter(it => !excluded.has(it.chunkId)), hasMore: false }) };
        }
        return { ok: true, json: async () => ({ items: testItems }) };
      }
      return { ok: true, json: async () => ({ items: [] }) };
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('c0'));

    // Start completion for c0
    let completePromise: Promise<boolean>;
    act(() => {
      completePromise = result.current.completeActiveChunk();
    });

    // c0 was optimistically completed and removed immediately, advancing activeItem to c1
    expect(result.current.activeItem?.chunkId).toBe('c1');
    expect(result.current.feedItems.map((it: any) => it.chunkId)).toEqual(['c1', 'c2', 'c3']);

    // While background completion sync is in-flight, navigate to c2 (index 1)
    act(() => {
      result.current.goToIndex(1);
    });
    expect(result.current.activeItem?.chunkId).toBe('c2');

    // Resolve the completion for c0
    await act(async () => {
      resolveCompletion({ ok: true });
      await completePromise;
    });

    // The activeItem MUST remain c2 and NOT snap back to index 0 (c1)
    expect(result.current.activeItem?.chunkId).toBe('c2');
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.feedItems.map((it: any) => it.chunkId)).toEqual(['c1', 'c2', 'c3']);
  });

  it('pauses direct HTML5 video when reaching chunk endSecs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ items: testItems }) }));
      const { result } = renderHook(() => usePlayback());
      await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('c0'));

      const mockVideo = document.createElement('video');
      mockVideo.pause = vi.fn();
      mockVideo.play = vi.fn().mockResolvedValue(undefined);
      mockVideo.currentTime = 50;

      act(() => {
        result.current.registerVideoElement(mockVideo);
      });

      // Active item c0 has endSeconds: 60. Simulate video reaching endSeconds (60)
      mockVideo.currentTime = 60;
      act(() => {
        vi.advanceTimersByTime(260);
      });

      expect(mockVideo.pause).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rolls back optimistic completion when server returns HTTP 200 with null progress', async () => {
    const chunkA = {
      chunkId: 'chunk-A',
      lessonId: 'lesson-1',
      cohortId: 'cohort-1',
      title: 'Intro to Algorithms',
      description: 'First part of the lecture',
      mediaSource: 'https://cdn.example.com/a.mp4',
      lessonTitle: 'Algorithms 101',
      cohortTitle: 'CS Basics',
      lessonOrder: 1,
      totalLessonsInSeason: 5,
      totalVideos: 5,
      startSeconds: 0,
      endSeconds: 60,
    };
    const chunkB = {
      ...chunkA,
      chunkId: 'chunk-B',
      startSeconds: 60,
      endSeconds: 120,
    };

    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/progress/chunk')) {
        return { ok: true, json: async () => ({ success: true, progress: null }) };
      }
      if (typeof url === 'string' && url.includes('/api/feed')) {
        return { ok: true, json: async () => ({ items: [chunkA, chunkB] }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { result } = renderHook(() => usePlayback());
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-A'));

    let success = true;
    await act(async () => {
      success = await result.current.completeActiveChunk();
    });

    expect(success).toBe(false);
    expect(result.current.completionError).toBe('Completion could not be saved. Retry.');
    expect(result.current.activeItem?.chunkId).toBe('chunk-A');
    expect(result.current.feedItems.map(it => it.chunkId)).toContain('chunk-A');
  });
});



