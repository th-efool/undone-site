/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNow } from '../hooks/useNow';

describe('useNow hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('returns current time and updates on interval', () => {
    const { result, unmount } = renderHook(() => useNow(1000));

    expect(result.current).toBe(100_000);
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(101_000);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
