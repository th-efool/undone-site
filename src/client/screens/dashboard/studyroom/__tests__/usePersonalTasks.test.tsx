/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePersonalTasks } from '../hooks/usePersonalTasks';
import type { PersonalTask } from '../types';

describe('usePersonalTasks hook', () => {
  it('initializes with empty list and empty draft', () => {
    const { result } = renderHook(() => usePersonalTasks());

    expect(result.current.tasks).toEqual([]);
    expect(result.current.draft).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('adds task using draft: trims, collapses whitespace, resets draft and error', () => {
    const { result } = renderHook(() => usePersonalTasks());

    act(() => {
      result.current.setDraft('   Review   chapter   1   ');
    });
    expect(result.current.draft).toBe('   Review   chapter   1   ');

    act(() => {
      const ok = result.current.add();
      expect(ok).toBe(true);
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].id).toBe('task-1');
    expect(result.current.tasks[0].text).toBe('Review chapter 1');
    expect(result.current.tasks[0].done).toBe(false);
    expect(result.current.tasks[0].createdAt).toBeTypeOf('number');
    expect(result.current.draft).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('adds task using direct custom text argument', () => {
    const { result } = renderHook(() => usePersonalTasks());

    act(() => {
      const ok = result.current.add('Task A');
      expect(ok).toBe(true);
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].text).toBe('Task A');
  });

  it('rejects empty and whitespace-only task with verbatim error', () => {
    const { result } = renderHook(() => usePersonalTasks());

    act(() => {
      const ok = result.current.add('   ');
      expect(ok).toBe(false);
    });

    expect(result.current.tasks).toHaveLength(0);
    expect(result.current.error).toBe('Write something first.');
  });

  it('clamps task text to 120 characters', () => {
    const { result } = renderHook(() => usePersonalTasks());
    const longText = 'A'.repeat(150);

    act(() => {
      const ok = result.current.add(longText);
      expect(ok).toBe(true);
    });

    expect(result.current.tasks[0].text).toBe('A'.repeat(120));
  });

  it('enforces 50 tasks limit with verbatim error message', () => {
    const initialTasks: PersonalTask[] = Array.from({ length: 50 }, (_, i) => ({
      id: `task-${i + 1}`,
      text: `Task ${i + 1}`,
      done: false,
      createdAt: 1000 + i,
    }));

    const { result } = renderHook(() => usePersonalTasks(initialTasks));
    expect(result.current.tasks).toHaveLength(50);

    act(() => {
      const ok = result.current.add('Task 51');
      expect(ok).toBe(false);
    });

    expect(result.current.tasks).toHaveLength(50);
    expect(result.current.error).toBe("You've reached 50 tasks. Finish or delete one first.");
  });

  it('toggles task done status while maintaining order', () => {
    const { result } = renderHook(() => usePersonalTasks());

    act(() => {
      result.current.add('Task 1');
      result.current.add('Task 2');
    });

    expect(result.current.tasks[0].done).toBe(false);

    act(() => {
      result.current.toggle('task-1');
    });

    expect(result.current.tasks[0].done).toBe(true);
    expect(result.current.tasks[1].done).toBe(false);
    expect(result.current.tasks[0].id).toBe('task-1');
    expect(result.current.tasks[1].id).toBe('task-2');

    act(() => {
      result.current.toggle('task-1');
    });

    expect(result.current.tasks[0].done).toBe(false);
  });

  it('edits task text, trims, collapses whitespace, preserves done state, rejects empty', () => {
    const { result } = renderHook(() => usePersonalTasks());

    act(() => {
      result.current.add('Original text');
    });
    act(() => {
      result.current.toggle('task-1');
    });

    expect(result.current.tasks[0].done).toBe(true);

    // Rejects empty edit
    act(() => {
      const ok = result.current.edit('task-1', '    ');
      expect(ok).toBe(false);
    });
    expect(result.current.error).toBe("A task can't be empty.");
    expect(result.current.tasks[0].text).toBe('Original text');

    // Valid edit
    act(() => {
      const ok = result.current.edit('task-1', '   Updated    summary   ');
      expect(ok).toBe(true);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.tasks[0].text).toBe('Updated summary');
    expect(result.current.tasks[0].done).toBe(true);
  });

  it('removes a task by id', () => {
    const { result } = renderHook(() => usePersonalTasks());

    act(() => {
      result.current.add('Task 1');
      result.current.add('Task 2');
      result.current.add('Task 3');
    });

    expect(result.current.tasks).toHaveLength(3);

    act(() => {
      result.current.remove('task-2');
    });

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks.map((t) => t.id)).toEqual(['task-1', 'task-3']);
  });

  it('reorders tasks up and down with boundary protection', () => {
    const { result } = renderHook(() => usePersonalTasks());

    act(() => {
      result.current.add('Task 1');
      result.current.add('Task 2');
      result.current.add('Task 3');
    });

    // Move top task up -> no-op
    act(() => {
      result.current.move('task-1', 'up');
    });
    expect(result.current.tasks.map((t) => t.id)).toEqual(['task-1', 'task-2', 'task-3']);

    // Move task 2 up -> swaps with task 1
    act(() => {
      result.current.move('task-2', 'up');
    });
    expect(result.current.tasks.map((t) => t.id)).toEqual(['task-2', 'task-1', 'task-3']);

    // Move bottom task down -> no-op
    act(() => {
      result.current.move('task-3', 'down');
    });
    expect(result.current.tasks.map((t) => t.id)).toEqual(['task-2', 'task-1', 'task-3']);

    // Move task 2 down -> swaps with task 1
    act(() => {
      result.current.move('task-2', 'down');
    });
    expect(result.current.tasks.map((t) => t.id)).toEqual(['task-1', 'task-2', 'task-3']);
  });

  it('clears completed tasks while preserving incomplete tasks', () => {
    const { result } = renderHook(() => usePersonalTasks());

    act(() => {
      result.current.add('Task 1');
      result.current.add('Task 2');
      result.current.add('Task 3');
      result.current.toggle('task-2');
    });

    expect(result.current.tasks).toHaveLength(3);

    act(() => {
      result.current.clearCompleted();
    });

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks.map((t) => t.id)).toEqual(['task-1', 'task-3']);
  });
});
