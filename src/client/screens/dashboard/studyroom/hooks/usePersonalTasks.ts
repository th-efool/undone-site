import { useCallback, useRef, useState } from 'react';
import type { PersonalTask } from '../types';

export interface UsePersonalTasksReturn {
  tasks: PersonalTask[];
  draft: string;
  setDraft: (draft: string) => void;
  error: string | null;
  clearError: () => void;
  add: (customText?: string) => boolean;
  toggle: (id: string) => void;
  edit: (id: string, newText: string) => boolean;
  remove: (id: string) => void;
  move: (id: string, direction: 'up' | 'down') => void;
  clearCompleted: () => void;
}

export function usePersonalTasks(initialTasks?: PersonalTask[]): UsePersonalTasksReturn {
  const [tasks, setTasks] = useState<PersonalTask[]>(() => initialTasks ?? []);
  const [draft, setDraft] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Initialize ID counter higher than any initial task to maintain uniqueness
  const maxInitialId = (initialTasks ?? []).reduce((max, task) => {
    const match = /^task-(\d+)$/.exec(task.id);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  const nextIdRef = useRef<number>(maxInitialId + 1);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const add = useCallback(
    (customText?: string): boolean => {
      const raw = typeof customText === 'string' ? customText : draft;
      const cleaned = raw.trim().replace(/\s+/g, ' ');

      if (!cleaned) {
        setError('Write something first.');
        return false;
      }

      if (tasks.length >= 50) {
        setError("You've reached 50 tasks. Finish or delete one first.");
        return false;
      }

      const newTask: PersonalTask = {
        id: `task-${nextIdRef.current++}`,
        text: cleaned.slice(0, 120),
        done: false,
        createdAt: Date.now(),
      };

      setTasks((prev) => [...prev, newTask]);
      setDraft('');
      setError(null);
      return true;
    },
    [draft, tasks.length]
  );

  const toggle = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }, []);

  const edit = useCallback((id: string, newText: string): boolean => {
    const cleaned = newText.trim().replace(/\s+/g, ' ');

    if (!cleaned) {
      setError("A task can't be empty.");
      return false;
    }

    setError(null);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, text: cleaned.slice(0, 120) } : t
      )
    );
    return true;
  }, []);

  const remove = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const move = useCallback((id: string, direction: 'up' | 'down') => {
    setTasks((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => !t.done));
  }, []);

  return {
    tasks,
    draft,
    setDraft,
    error,
    clearError,
    add,
    toggle,
    edit,
    remove,
    move,
    clearCompleted,
  };
}
