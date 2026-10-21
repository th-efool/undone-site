/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
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

  describe('Durable Persistence & Account Isolation (Phase 10)', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('persists committed goal and visibility to user-scoped storage', () => {
      const { result } = renderHook(() => useSessionGoal(undefined, 'user-1'));

      act(() => {
        result.current.commit('Finish Chapter 5');
        result.current.setVisibility('room');
      });

      expect(result.current.committed.text).toBe('Finish Chapter 5');
      expect(result.current.committed.visibility).toBe('room');

      // Mount a new hook with user-1 -> should hydrate the saved goal
      const { result: hydrated } = renderHook(() => useSessionGoal(undefined, 'user-1'));
      expect(hydrated.current.committed.text).toBe('Finish Chapter 5');
      expect(hydrated.current.committed.visibility).toBe('room');
    });

    it('isolates goals between user accounts', () => {
      const { result: alice } = renderHook(() => useSessionGoal(undefined, 'user-alice'));

      act(() => {
        alice.current.commit('Secret Research');
      });

      // Bob mounts -> should not see Alice's goal
      const { result: bob } = renderHook(() => useSessionGoal(undefined, 'user-bob'));
      expect(bob.current.committed.text).toBe('');

      // Alice still has her goal
      const { result: aliceAgain } = renderHook(() => useSessionGoal(undefined, 'user-alice'));
      expect(aliceAgain.current.committed.text).toBe('Secret Research');
    });

    it('removes published goal when visibility switches from room to private', () => {
      const { result } = renderHook(() =>
        useSessionGoal({ text: 'Public Chapter 2', visibility: 'room' }, 'user-carol')
      );

      expect(result.current.committed.visibility).toBe('room');

      act(() => {
        result.current.setVisibility('private');
      });

      expect(result.current.committed.visibility).toBe('private');

      // Hydrating again preserves private state
      const { result: refreshed } = renderHook(() => useSessionGoal(undefined, 'user-carol'));
      expect(refreshed.current.committed.visibility).toBe('private');
    });
  });
});
