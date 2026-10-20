/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSessionGoal } from '../hooks/useSessionGoal';

describe('useSessionGoal hook', () => {
  it('initializes with private visibility and empty text by default', () => {
    const { result } = renderHook(() => useSessionGoal());

    expect(result.current.committed).toEqual({
      text: '',
      visibility: 'private',
    });
    expect(result.current.draft).toBe('');
  });

  it('updates draft independently of committed goal until commit() is called', () => {
    const { result } = renderHook(() => useSessionGoal());

    act(() => {
      result.current.setDraft('Drafting my goal');
    });

    expect(result.current.draft).toBe('Drafting my goal');
    expect(result.current.committed.text).toBe('');

    act(() => {
      result.current.commit();
    });

    expect(result.current.committed.text).toBe('Drafting my goal');
    expect(result.current.draft).toBe('Drafting my goal');
  });

  it('commits with custom text argument, trims whitespace and clamps to 80 chars', () => {
    const { result } = renderHook(() => useSessionGoal());
    const longGoal = '   ' + 'A'.repeat(100) + '   ';

    act(() => {
      result.current.commit(longGoal);
    });

    expect(result.current.committed.text).toBe('A'.repeat(80));
    expect(result.current.draft).toBe('A'.repeat(80));
  });

  it('commits empty or whitespace-only text as empty string', () => {
    const { result } = renderHook(() =>
      useSessionGoal({ text: 'Existing goal', visibility: 'private' })
    );

    expect(result.current.committed.text).toBe('Existing goal');

    act(() => {
      result.current.commit('     ');
    });

    expect(result.current.committed.text).toBe('');
    expect(result.current.draft).toBe('');
  });

  it('toggles visibility immediately without requiring commit', () => {
    const { result } = renderHook(() =>
      useSessionGoal({ text: 'Active goal', visibility: 'private' })
    );

    expect(result.current.committed.visibility).toBe('private');

    act(() => {
      result.current.setVisibility('room');
    });

    expect(result.current.committed.visibility).toBe('room');
    expect(result.current.committed.text).toBe('Active goal');

    act(() => {
      result.current.setVisibility('private');
    });

    expect(result.current.committed.visibility).toBe('private');
  });
});
