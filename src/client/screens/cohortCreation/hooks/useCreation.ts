'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { creationSnapshotSchema, querySchema, type CreationSnapshot, type StartingPoint } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { CreationClientError, requestRecommendations } from '../services/creationApi';
import { loadSessionDraft, saveSessionDraft } from '../services/sessionDraftStore';

type ViewState = { snapshot: CreationSnapshot; hydrated: boolean; saved: boolean };
export function useCreation(draftId: string, initialQuery: string, resume: boolean) {
  const [view, render] = useReducer((_: ViewState, next: ViewState) => next, {
    snapshot: initialSnapshot(draftId), hydrated: false, saved: true,
  });
  const current = useRef(view.snapshot);
  const controller = useRef<AbortController | null>(null);

  const update = useCallback((next: CreationSnapshot) => {
    current.current = creationSnapshotSchema.parse(next);
    let saved = false;
    try { saved = saveSessionDraft(next, window.sessionStorage); } catch { /* browser storage may be disabled */ }
    render({ snapshot: current.current, hydrated: true, saved });
    return saved;
  }, []);

  const runQuery = useCallback(async (query: string) => {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) return;
    controller.current?.abort();
    const operation = new AbortController();
    controller.current = operation;
    const next = applyCommand(current.current, { type: 'request_recommendations', query: parsed.data, requestId: crypto.randomUUID() });
    update(next);
    const requestId = next.activeRequestId!;
    try {
      const result = await requestRecommendations({ requestId, query: next.query, inputRevision: next.inputRevision }, operation.signal);
      update(applyEvent(current.current, { type: 'recommendations_received', result }));
    } catch (error) {
      update(applyEvent(current.current, operation.signal.aborted
        ? { type: 'operation_cancelled', requestId }
        : { type: 'operation_failed', requestId, error: error instanceof CreationClientError ? error.detail : {
          code: 'AI_UNAVAILABLE', message: 'Recommendations could not be loaded. Try again.', retryable: true,
        } }));
    } finally {
      if (controller.current === operation) controller.current = null;
    }
  }, [update]);

  useEffect(() => {
    // Scheduling prevents React development effect replay from submitting twice.
    const timer = window.setTimeout(() => {
      let restored: CreationSnapshot | null = null;
      if (resume) {
        try { restored = loadSessionDraft(draftId, window.sessionStorage); } catch { /* unavailable storage */ }
      }
      update(restored ?? initialSnapshot(draftId));
      if (!resume && querySchema.safeParse(initialQuery).success) void runQuery(initialQuery);
    }, 0);
    return () => { window.clearTimeout(timer); controller.current?.abort(); };
  }, [draftId, initialQuery, resume, runQuery, update]);

  const createOwn = () => update(applyCommand(current.current, { type: 'create_own' }));
  const chooseStartingPoint = (startingPoint: StartingPoint) => update(applyCommand(current.current, { type: 'choose_starting_point', startingPoint }));
  const back = () => update(applyCommand(current.current, { type: 'back_to_recommendations' }));
  const cancel = () => {
    const requestId = current.current.activeRequestId;
    controller.current?.abort();
    if (requestId) update(applyEvent(current.current, { type: 'operation_cancelled', requestId }));
  };
  return { ...view, runQuery, createOwn, chooseStartingPoint, back, cancel };
}
