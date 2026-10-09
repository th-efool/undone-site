'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { type CreationSnapshot, type StartingPoint, querySchema } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, initialSnapshot, type CreationCommand } from '@/src/shared/cohort-creation/flow';
import { draftApi, DraftApiError } from '../services/draftApi';
import { observeDraftEvents } from '../services/draftEvents';

type ViewState = { snapshot: CreationSnapshot; hydrated: boolean; saved: boolean; message: string | null };
export function useCreation(draftId: string, initialQuery: string, resume: boolean) {
  const [view, render] = useReducer((_: ViewState, next: ViewState) => next, {
    snapshot: initialSnapshot(draftId), hydrated: false, saved: false, message: null,
  });
  const current = useRef(view.snapshot);
  const controller = useRef<AbortController | null>(null);
  const editPending = useRef(false);
  const display = useCallback((snapshot: CreationSnapshot, saved = true, message: string | null = null) => {
    if (snapshot.draftId !== current.current.draftId || snapshot.revision < current.current.revision) return;
    current.current = snapshot;
    render({ snapshot, hydrated: true, saved, message });
  }, []);
  const failure = useCallback((error: unknown) => {
    const restored = error instanceof DraftApiError && error.current?.draftId === draftId && error.current.revision >= current.current.revision ? error.current : current.current;
    display(restored, false, error instanceof DraftApiError ? error.message : 'Draft storage is unavailable. Retry or reload this page.');
  }, [display, draftId]);
  const send = useCallback(async (command: CreationCommand, signal?: AbortSignal) => {
    const base = current.current;
    try {
      const saved = await draftApi.command(draftId, base.revision, command, signal);
      if (saved.revision >= current.current.revision) display(saved);
      return true;
    } catch (error) {
      if (!signal?.aborted) failure(error);
      return false;
    }
  }, [draftId, display, failure]);
  const runQuery = useCallback(async (query: string) => {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) return;
    controller.current?.abort();
    const operation = new AbortController(); controller.current = operation;
    const command: CreationCommand = { type: 'request_recommendations', query: parsed.data, requestId: crypto.randomUUID() };
    render({ snapshot: applyCommand(current.current, command), hydrated: true, saved: false, message: null });
    await send(command, operation.signal);
    if (controller.current === operation) controller.current = null;
  }, [send]);
  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(async () => {
      try {
        const snapshot = resume ? await draftApi.load(draftId) : await draftApi.create(draftId);
        if (disposed) return;
        display(snapshot);
        if (!resume) {
          window.history.replaceState(window.history.state, '', `/quest/draft/${draftId}`);
          if (querySchema.safeParse(initialQuery).success) await runQuery(initialQuery);
        }
      } catch (error) { if (!disposed) failure(error); }
    }, 0);
    return () => { disposed = true; window.clearTimeout(timer); controller.current?.abort(); };
  }, [draftId, initialQuery, resume, display, failure, runQuery]);
  // This connection only observes persisted work. Disconnecting cannot cancel a job.
  useEffect(() => {
    if (!view.hydrated || view.snapshot.status !== 'running') return;
    const observer = new AbortController();
    void observeDraftEvents({
      draftId, signal: observer.signal,
      onEvent: event => { if (!observer.signal.aborted) display(event.snapshot); },
      reload: async () => {
        const snapshot = await draftApi.load(draftId, observer.signal);
        if (!observer.signal.aborted && snapshot.revision >= current.current.revision) display(snapshot);
      },
      onConnectionChange: state => {
        if (!observer.signal.aborted && state === 'reconnecting') render({ snapshot: current.current, hydrated: true, saved: true, message: 'Connection interrupted. Your work continues on the server; reconnecting…' });
      },
    }).catch(() => { /* Aborted observers never mutate durable job state. */ });
    return () => { observer.abort(); };
  }, [draftId, view.hydrated, view.snapshot.status, display]);
  const edit = async (command: CreationCommand) => {
    if (editPending.current) return false;
    editPending.current = true;
    try { return await send(command); } finally { editPending.current = false; }
  };
  const cancel = async () => {
    const expectedRequestId = current.current.activeRequestId;
    controller.current?.abort();
    try {
      const latest = await draftApi.load(draftId);
      display(latest);
      if (latest.activeRequestId !== expectedRequestId) {
        display(latest, true, 'The active request changed. Review the current draft before canceling.');
        return;
      }
      await edit({ type: 'cancel_recommendations' });
    } catch (error) { failure(error); }
  };
  return { ...view, runQuery, cancel, createOwn: () => edit({ type: 'create_own' }),
    chooseStartingPoint: (startingPoint: StartingPoint) => edit({ type: 'choose_starting_point', startingPoint }),
    back: () => edit({ type: 'back_to_recommendations' }) };
}
