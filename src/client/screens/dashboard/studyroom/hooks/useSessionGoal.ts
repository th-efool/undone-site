import { useCallback, useState } from 'react';
import type { GoalVisibility, SessionGoal } from '../types';

export interface UseSessionGoalReturn {
  committed: SessionGoal;
  draft: string;
  setDraft: (draft: string) => void;
  commit: (textToCommit?: string) => void;
  setVisibility: (visibility: GoalVisibility) => void;
}

export function useSessionGoal(initialGoal?: Partial<SessionGoal>): UseSessionGoalReturn {
  const [committed, setCommitted] = useState<SessionGoal>(() => ({
    text: initialGoal?.text?.trim().slice(0, 80) ?? '',
    visibility: initialGoal?.visibility ?? 'private',
  }));

  const [draft, setDraft] = useState<string>(() => committed.text);

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
