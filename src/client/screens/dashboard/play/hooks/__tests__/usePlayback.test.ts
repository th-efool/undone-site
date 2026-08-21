// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
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
