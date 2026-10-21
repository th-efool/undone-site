'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
  tasksStorageAdapter,
  UnifiedTask,
  TONE_TO_HEX,
  HEX_TO_TONE,
} from '@/src/client/repositories/tasksStorageAdapter';

export type { UnifiedTask };
export { TONE_TO_HEX, HEX_TO_TONE };

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

export function useUnifiedTasks() {
  const { data: session } = useSafeSession();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    tasksStorageAdapter.setUserId(userId);
  }, [userId]);

  const tasks = useSyncExternalStore(
    tasksStorageAdapter.subscribe,
    tasksStorageAdapter.getTasks,
    tasksStorageAdapter.getServerSnapshot
  );

  const getTasksForDate = useCallback(
    (year: number, month: number, day: number): UnifiedTask[] => {
      return tasks.filter((t) => t.year === year && t.month === month && t.day === day);
    },
    [tasks]
  );

  const getDaysWithTasks = useCallback(
    (year: number, month: number): Record<number, string> => {
      const result: Record<number, string> = {};
      tasks.forEach((t) => {
        if (t.year === year && t.month === month) {
          // If already set, keep existing or prioritize non-completed
          if (!result[t.day] || t.status === 'pending') {
            result[t.day] = t.color || (t.tone ? TONE_TO_HEX[t.tone] : '#3b82f6');
          }
        }
      });
      return result;
    },
    [tasks]
  );

  const addTask = useCallback(
    (partial: Omit<UnifiedTask, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => {
      return tasksStorageAdapter.addTask(partial);
    },
    []
  );

  const updateTask = useCallback((id: string, updates: Partial<UnifiedTask>) => {
    tasksStorageAdapter.updateTask(id, updates);
  }, []);

  const toggleTask = useCallback((id: string) => {
    tasksStorageAdapter.toggleTask(id);
  }, []);

  const removeTask = useCallback((id: string) => {
    tasksStorageAdapter.removeTask(id);
  }, []);

  const resetToDefault = useCallback(() => {
    tasksStorageAdapter.resetToDefault();
  }, []);

  const importLocalTasks = useCallback(
    (confirmed: boolean) => {
      if (!userId) {
        throw new Error('Must be logged in to import local tasks');
      }
      return tasksStorageAdapter.importLocalTasks(userId, confirmed);
    },
    [userId]
  );

  return useMemo(
    () => ({
      tasks,
      getTasksForDate,
      getDaysWithTasks,
      addTask,
      updateTask,
      toggleTask,
      removeTask,
      resetToDefault,
      importLocalTasks,
    }),
    [
      tasks,
      getTasksForDate,
      getDaysWithTasks,
      addTask,
      updateTask,
      toggleTask,
      removeTask,
      resetToDefault,
      importLocalTasks,
    ]
  );
}
