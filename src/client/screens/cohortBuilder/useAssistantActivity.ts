'use client';

import { useEffect, useRef, useState } from 'react';
import { useInteractionState } from '@/src/client/interaction/hooks';

export type AssistantTurnView = { messageId: string; runId: string | null; status: string };

const FAST_POLL_INTERVAL_MS = 2000;
const IDLE_POLL_INTERVAL_MS = 20000;

/** Bounded run diagnostics only; the package store remains workspace authority. */
export function useAssistantActivity() {
  const state = useInteractionState();
  const [turns, setTurns] = useState<AssistantTurnView[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const etagRef = useRef<string | null>(null);
  const currentWorkspaceIdRef = useRef(state?.workspaceId);

  // Reset ETag when switching workspaces
  if (currentWorkspaceIdRef.current !== state?.workspaceId) {
    currentWorkspaceIdRef.current = state?.workspaceId;
    etagRef.current = null;
  }

  useEffect(() => {
    if (!state?.workspaceId) {
      return;
    }

    const controller = new AbortController();
    let active = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let currentDelay = FAST_POLL_INTERVAL_MS;

    const scheduleNext = (delay: number) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      timer = setTimeout(() => {
        void refresh();
      }, delay);
    };

    const refresh = async () => {
      // Skip fetch if tab or window is backgrounded/hidden
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      if (active) return;
      active = true;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      try {
        const headers: Record<string, string> = {};
        if (etagRef.current) {
          headers['If-None-Match'] = etagRef.current;
        }

        const response = await fetch(`/api/cohort-builder/workspaces/${state.workspaceId}/activity`, {
          cache: 'no-store',
          signal: controller.signal,
          headers,
        });

        // 304 Not Modified: data is unchanged, preserve existing turns without re-rendering or re-parsing JSON
        if (response.status === 304) {
          if (!controller.signal.aborted) {
            setUnavailable(false);
            scheduleNext(currentDelay);
          }
          return;
        }

        if (!response.ok) {
          throw new Error('ACTIVITY_UNAVAILABLE');
        }

        const etag = response.headers.get('ETag') || response.headers.get('etag');
        if (etag) {
          etagRef.current = etag;
        }

        const body = await response.json();
        if (!controller.signal.aborted) {
          setTurns(body.turns ?? []);
          setUnavailable(false);

          const hasActiveRun = body.turns?.some(
            (t: AssistantTurnView) => t.status === 'pending' || t.status === 'running' || t.status === 'queued'
          );
          currentDelay = hasActiveRun ? FAST_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
          scheduleNext(currentDelay);
        }
      } catch {
        if (!controller.signal.aborted) {
          setUnavailable(true);
          scheduleNext(currentDelay);
        }
      } finally {
        active = false;
      }
    };

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        void refresh();
      } else if (document.visibilityState === 'hidden') {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    void refresh();

    return () => {
      controller.abort();
      if (timer) {
        clearTimeout(timer);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [state?.workspaceId, state?.sequence]);

  return { turns, unavailable };
}
