'use client';
import type { z } from 'zod';
import type { reviewPatchSchema, lessonEditSchema } from '@/src/shared/cohort-creation/review-flow';

import type { GithubSelection } from '@/src/shared/cohort-creation/github';
import type { DiscoveryCandidate } from '@/src/shared/cohort-creation/discovery';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { type CreationSnapshot, type StartingPoint, querySchema } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, initialSnapshot, type CreationCommand } from '@/src/shared/cohort-creation/flow';
import { draftApi, DraftApiError } from '../services/draftApi';
import { observeDraftEvents } from '../services/draftEvents';
import { materialApi } from '../services/materialApi';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { PDF_LIMITS } from '@/src/shared/cohort-creation/pdf';

type ViewState = { snapshot: CreationSnapshot; hydrated: boolean; saved: boolean; message: string | null };
export function useCreation(draftId: string, initialQuery: string, resume: boolean) {
  const [view, render] = useReducer((_: ViewState, next: ViewState) => next, {
    snapshot: initialSnapshot(draftId), hydrated: false, saved: false, message: null,
  });
  const current = useRef(view.snapshot);
  const controller = useRef<AbortController | null>(null);
  const editPending = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState(false);
  const [materialPending, setMaterialPending] = useState(false);
  const display = useCallback((snapshot: CreationSnapshot, saved = true, message: string | null = null) => {
    if (snapshot.draftId !== current.current.draftId || snapshot.revision < current.current.revision) return;
    current.current = snapshot;
    render({ snapshot, hydrated: true, saved, message });
  }, []);
  const failure = useCallback((error: unknown) => {
    const restored = error instanceof DraftApiError && error.current?.draftId === draftId && error.current.revision >= current.current.revision ? error.current : current.current;
    display(restored, false, error instanceof DraftApiError ? error.message : 'Draft storage is unavailable. Retry or reload this page.');
  }, [display, draftId]);
  const send = useCallback(async (command: CreationCommand, signal?: AbortSignal, baseRevision?: number) => {
    const base = current.current;
    try {
      const saved = await draftApi.command(draftId, baseRevision ?? base.revision, command, signal);
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
    return () => { disposed = true; window.clearTimeout(timer); controller.current?.abort(); uploadController.current?.abort(); };
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
      await edit({ type: latest.stage === 'processing' || latest.stage === 'review' || latest.stage === 'finalizing' ? 'cancel_processing' : latest.stage === 'starting_point' ? 'cancel_material_acquisition' : 'cancel_recommendations' });
    } catch (error) { failure(error); }
  };
  const uploadText = async (bytes: Blob, filename: string, materialId?: string) => {
    if (editPending.current) return false;
    const pdf = bytes.type === 'application/pdf';
    if (!bytes.size || bytes.size > (pdf ? PDF_LIMITS.bytes : MATERIAL_LIMITS.extractedTextBytes)) {
      failure(new DraftApiError(`Provide ${pdf ? 'a PDF up to 25 MiB' : 'text up to 1 MiB'}. Select a smaller source; nothing was truncated.`, 413)); return false;
    }
    const base = current.current;
    const operation = new AbortController(); uploadController.current = operation;
    editPending.current = true; setUploading(true); setMaterialPending(true);
    try {
      const ref = await materialApi.upload(draftId, bytes, base.revision, filename, operation.signal, materialId);
      operation.signal.throwIfAborted();
      uploadController.current = null; setUploading(false);
      // Always use the captured revision: never attach an earlier upload to a newer intent.
      return await send({ type: pdf ? 'acquire_pdf' : 'acquire_text', materialId: materialId ?? crypto.randomUUID(), assetId: ref.id,
        requestId: crypto.randomUUID() }, undefined, base.revision);
    } catch (error) {
      if (operation.signal.aborted) display(current.current, true, 'Upload canceled. Select material to retry.');
      else failure(error);
      return false;
    } finally {
      if (uploadController.current === operation) uploadController.current = null;
      editPending.current = false; setUploading(false); setMaterialPending(false);
    }
  };
  return { ...view, uploading, materialPending, uploadText, cancelUpload: () => uploadController.current?.abort(),
    finalize: (mode: 'private_activation' | 'public_publish') => edit({ type: 'finalize_creation', mode, requestId: crypto.randomUUID() }),
    openReview: () => edit({ type: 'open_review' }),
    editReview: (patch: z.infer<typeof reviewPatchSchema>) => edit({ type: 'edit_review', patch }),
    editLesson: (lessonId: string, patch: Omit<z.infer<typeof lessonEditSchema>, 'lessonId'>) => edit({ type: 'edit_lesson', lessonId, ...patch }),
    requestRefinement: (prompt: string) => edit({ type: 'refine_curriculum', prompt, requestId: crypto.randomUUID() }),
    applyRefinement: (requestId: string) => edit({ type: 'apply_refinement', requestId }),
    discardRefinement: (requestId: string) => edit({ type: 'discard_refinement', requestId }),
    discardOrphanedEdits: (lessonIds: string[]) => edit({ type: 'discard_orphaned_edits', lessonIds }),
    understandMaterial: () => edit({ type: 'understand_material', requestId: crypto.randomUUID() }),
    buildCurriculum: () => edit({ type: 'build_curriculum', requestId: crypto.randomUUID() }),
    analyzeMaterial: () => edit({ type: 'analyze_material', requestId: crypto.randomUUID() }),
    chunkMaterial: () => edit({ type: 'chunk_material', requestId: crypto.randomUUID() }),
    backToMaterials: () => edit({ type: 'back_to_materials' }),
    discoverMaterial: () => edit({ type: 'discover_material', requestId: crypto.randomUUID() }),
    acquireDiscovered: (candidate: DiscoveryCandidate) => {
      if (candidate.kind === 'github') return Promise.resolve(false); // GitHub requires explicit ref/path selection.
      return edit({ type: candidate.kind === 'web' ? 'acquire_web' : 'inspect_youtube',
        materialId: crypto.randomUUID(), requestId: crypto.randomUUID(), url: candidate.url });
    },
    selectYoutubeUnits: (materialId: string, unitIds: string[]) => edit({ type: 'select_youtube_units', materialId, unitIds }),
    observeYoutube: (materialId: string) => edit({ type: 'observe_youtube', materialId, requestId: crypto.randomUUID() }),
    acquireGithub: (selection: GithubSelection, materialId?: string) => edit({ type: 'acquire_github', materialId: materialId ?? crypto.randomUUID(), requestId: crypto.randomUUID(), selection }),
    acquireNotion: (url: string, materialId?: string) => edit({ type: 'acquire_notion', materialId: materialId ?? crypto.randomUUID(), requestId: crypto.randomUUID(), url }),
    removeMaterial: (materialId: string) => edit({ type: 'remove_material', materialId }),
    acquireWeb: (url: string, materialId?: string) => {
      let youtube = false;
      try { youtube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(new URL(url).hostname); } catch { /* Server validation supplies the canonical error. */ }
      return edit({ type: youtube ? 'inspect_youtube' : 'acquire_web', materialId: materialId ?? crypto.randomUUID(), url, requestId: crypto.randomUUID() });
    },
    retryMaterial: (materialId: string, assetId: string) => edit({ type: current.current.materials.find(source => source.id === materialId)?.kind === 'pdf' ? 'acquire_pdf' : 'acquire_text', materialId, assetId, requestId: crypto.randomUUID() }),
    runQuery, cancel, createOwn: () => edit({ type: 'create_own' }),
    chooseStartingPoint: (startingPoint: StartingPoint) => edit({ type: 'choose_starting_point', startingPoint }),
    back: () => edit({ type: 'back_to_recommendations' }) };
}
