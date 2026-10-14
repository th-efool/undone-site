'use client';
import { useEffect, useState } from 'react';
import { useInteractionState } from '@/src/client/interaction/hooks';
export type AssistantTurnView = { messageId: string; runId: string | null; status: string };
/** Bounded run diagnostics only; the package store remains workspace authority. */
export function useAssistantActivity() {
  const state = useInteractionState();
  const [turns, setTurns] = useState<AssistantTurnView[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let active = false;
    const refresh = async () => {
      if (active) return; active = true;
      try {
        const response = await fetch(`/api/cohort-builder/workspaces/${state.workspaceId}/activity`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('ACTIVITY_UNAVAILABLE');
        const body = await response.json();
        if (!controller.signal.aborted) { setTurns(body.turns); setUnavailable(false); }
      } catch { if (!controller.signal.aborted) setUnavailable(true); }
      finally { active = false; }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 2000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [state.workspaceId, state.sequence]);
  return { turns, unavailable };
}
