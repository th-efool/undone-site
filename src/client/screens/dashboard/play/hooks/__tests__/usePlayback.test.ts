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
        return { ok: true, json: async () => ({ success: true }) };
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

    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/progress/chunk')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (typeof url === 'string' && url.includes('pageIndex=0')) {
        return { ok: true, json: async () => ({ items: [chunkLast] }) };
      }
      if (typeof url === 'string' && url.includes('pageIndex=1')) {
        return { ok: true, json: async () => ({ items: [chunkNextPage] }) };
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

    // Wait for the background prefetch of page 1 to resolve and append
    await waitFor(() => expect(result.current.activeItem?.chunkId).toBe('chunk-next-page'));
    expect(result.current.feedItems.map(it => it.chunkId)).toContain('chunk-next-page');

    const feedCalls = fetchMock.mock.calls.filter((c: any[]) => typeof c[0] === 'string' && c[0].includes('/api/feed'));
    expect(feedCalls.some((c: any[]) => c[0].includes('pageIndex=1'))).toBe(true);
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

    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/progress/chunk')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (typeof url === 'string' && url.includes('pageIndex=0')) {
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
      if (typeof url === 'string' && url.includes('pageIndex=0')) {
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
      if (typeof url === 'string' && url.includes('pageIndex=0')) {
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
});

