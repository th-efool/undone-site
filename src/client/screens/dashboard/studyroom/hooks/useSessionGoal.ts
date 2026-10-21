import { useCallback, useEffect, useState } from 'react';
import type { GoalVisibility, SessionGoal } from '../types';

const GOAL_STORAGE_PREFIX = 'sidequest_session_goal_v1:';

function getStorageKey(userId?: string | null): string {
  return `${GOAL_STORAGE_PREFIX}${userId || 'anon'}`;
}

export interface UseSessionGoalReturn {
  committed: SessionGoal;
  draft: string;
  setDraft: (draft: string) => void;
  commit: (textToCommit?: string) => void;
  setVisibility: (visibility: GoalVisibility) => void;
}

export function clearSessionGoal(userId?: string | null): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(getStorageKey(userId));
    } catch {}
  }
}

export function useSessionGoal(
  initialGoal?: Partial<SessionGoal>,
  userId?: string | null
): UseSessionGoalReturn {
  const [committed, setCommitted] = useState<SessionGoal>(() => {
    if (initialGoal?.text !== undefined || initialGoal?.visibility !== undefined) {
      return {
        text: initialGoal?.text?.trim().slice(0, 80) ?? '',
        visibility: initialGoal?.visibility ?? 'private',
      };
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(getStorageKey(userId));
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SessionGoal>;
          return {
            text: typeof parsed.text === 'string' ? parsed.text.trim().slice(0, 80) : '',
            visibility: parsed.visibility === 'room' ? 'room' : 'private',
          };
        }
      } catch {}
    }
    return {
      text: '',
      visibility: 'private',
    };
  });

  const [draft, setDraft] = useState<string>(() => committed.text);
  const [prevUserId, setPrevUserId] = useState(userId);

  // Rehydrate on user switch or logout
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    let nextGoal: SessionGoal = { text: '', visibility: 'private' };
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(getStorageKey(userId));
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SessionGoal>;
          nextGoal = {
            text: typeof parsed.text === 'string' ? parsed.text.trim().slice(0, 80) : '',
            visibility: parsed.visibility === 'room' ? 'room' : 'private',
          };
        }
      } catch {}
    }
    setCommitted(nextGoal);
    setDraft(nextGoal.text);
  }

  // Persist to user-scoped storage whenever committed changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(committed));
    } catch {}
  }, [committed, userId]);

  const commit = useCallback(
    (textToCommit?: string) => {
      const raw = typeof textToCommit === 'string' ? textToCommit : draft;
      const cleaned = raw.trim().slice(0, 80);

      setCommitted((prev) => ({
        ...prev,
        text: cleaned,
      }));
      setDraft(cleaned);
    },
    [draft]
  );

  const setVisibility = useCallback((visibility: GoalVisibility) => {
    setCommitted((prev) => ({
      ...prev,
      visibility,
    }));
  }, []);

  return {
    committed,
    draft,
    setDraft,
    commit,
    setVisibility,
  };
}
