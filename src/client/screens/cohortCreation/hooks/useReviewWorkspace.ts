'use client';
import { useEffect, useRef, useState } from 'react';
import type { useCreation } from './useCreation';
import type { GeneratedCurriculum } from '@/src/shared/cohort-creation/artifacts';
import type { ReviewWorkspace } from '@/src/shared/cohort-creation/review';
import { lessonEditSchema, reviewPatchSchema } from '@/src/shared/cohort-creation/review-flow';
import { loadReview, type ReviewResponse } from '../services/reviewApi';

export type ReviewFields = Pick<ReviewWorkspace, 'title' | 'description' | 'visibility' | 'chatEnabled' | 'eventsEnabled'>;
export type LessonFields = { title: string; objectives: string };
export type ReviewLesson = GeneratedCurriculum['seasons'][number]['lessons'][number];

/** Local unsaved copy stays separate from canonical review and owned artifact reads. */
export function useReviewWorkspace(creation: ReturnType<typeof useCreation>) {
  const { snapshot } = creation; const review = snapshot.review!;
  const [metadata, setMetadata] = useState<ReviewFields | null>(null);
  const [lessonEdits, setLessonEdits] = useState<Record<string, LessonFields>>({});
  const [loaded, setLoaded] = useState<ReviewResponse | null>(null);
  const [readError, setReadError] = useState<{ revision: number; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reload, setReload] = useState(0); const [pending, setPending] = useState(false);
  const lock = useRef(false); const pageController = useRef<AbortController | null>(null);
  const currentRevision = useRef(snapshot.revision);
  useEffect(() => {
    currentRevision.current = snapshot.revision;
    const controller = new AbortController();
    void loadReview(snapshot.draftId, controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setLoaded(value);
        setReadError(value.revision === snapshot.revision && value.curriculum.version === review.buildFingerprint ? null : { revision: snapshot.revision, message: 'The saved review changed. Reload the draft to continue.' });
      }
    }).catch(reason => { if (!controller.signal.aborted) setReadError({ revision: snapshot.revision, message: reason instanceof Error ? reason.message : 'Review unavailable.' }); });
    return () => { controller.abort(); pageController.current?.abort(); };
  }, [snapshot.draftId, snapshot.revision, review.buildFingerprint, reload]);
  const preview = loaded?.revision === snapshot.revision && loaded.curriculum.version === review.buildFingerprint ? loaded : null;
  const error = readError?.revision === snapshot.revision ? readError.message : null;
  const fields = metadata ?? { title: review.title, description: review.description, visibility: review.visibility, chatEnabled: review.chatEnabled, eventsEnabled: review.eventsEnabled };
  const dirty = metadata !== null || Object.keys(lessonEdits).length > 0;
  const running = snapshot.status === 'running';
  const disabled = running || pending || !creation.saved || Boolean(creation.materialPending);
  const act = async (action: () => Promise<boolean>) => {
    if (lock.current || running || !creation.saved || creation.materialPending) return false;
    lock.current = true; setPending(true); setActionError(null);
    try { const accepted = await action(); if (!accepted) setActionError(current => current ?? 'Change was not saved. Your unsaved edits are still here.'); return accepted; }
    catch { setActionError('Change could not be saved. Retry without losing your edits.'); return false; }
    finally { lock.current = false; setPending(false); }
  };
  const saveMetadata = async () => {
    if (!metadata) return true;
    const captured = metadata; const parsed = reviewPatchSchema.safeParse(captured);
    if (!parsed.success) { setActionError('Enter a title and description within the displayed limits.'); return false; }
    if (!await creation.editReview(parsed.data)) return false;
    setMetadata(current => current === captured ? null : current); return true;
  };
  const saveLesson = async (id: string) => {
    const captured = lessonEdits[id]; if (!captured) return true;
    const parsed = lessonEditSchema.safeParse({ lessonId: id, title: captured.title, objectives: captured.objectives.split('\n').map(item => item.trim()).filter(Boolean) });
    if (!parsed.success || !review.lessonIds.includes(id)) { setActionError('Check the lesson title and 1–20 objectives (at most 1000 characters each). Unmatched edits must be resolved first.'); return false; }
    if (!await creation.editLesson(id, { title: parsed.data.title, objectives: parsed.data.objectives })) return false;
    setLessonEdits(current => { if (current[id] !== captured) return current; const next = { ...current }; delete next[id]; return next; }); return true;
  };
  const canFinalize = !disabled && Boolean(preview) && !error && !dirty && !review.proposal && !review.request && !review.orphanedLessonIds.length;
  return { snapshot, review, fields, preview, error, actionError, disabled, running, pending, dirty,
    metadataDirty: metadata !== null, lessonEdits,
    changeMetadata: (patch: Partial<ReviewFields>) => setMetadata({ ...fields, ...patch }),
    changeLesson: (id: string, value: LessonFields) => setLessonEdits(previous => ({ ...previous, [id]: value })),
    unmatchedLocalIds: Object.keys(lessonEdits).filter(id => !review.lessonIds.includes(id)),
    discardLocalLesson: (id: string) => setLessonEdits(previous => { const next = { ...previous }; delete next[id]; return next; }),
    reload: async () => { if (await creation.reload()) setReload(value => value + 1); },
    saveMetadata: () => act(saveMetadata), saveLesson: (id: string) => act(() => saveLesson(id)),
    saveAll: () => act(async () => { if (!await saveMetadata()) return false; for (const id of Object.keys(lessonEdits)) if (!await saveLesson(id)) return false; return true; }),
    canFinalize, canRefine: canFinalize,
    requestRefinement: (prompt: string) => canFinalize ? act(() => creation.requestRefinement(prompt)) : Promise.resolve(false),
    applyProposal: () => !dirty && preview && !error && review.proposal && !review.orphanedLessonIds.length && review.proposal.baseEditRevision === review.editRevision ? act(() => creation.applyRefinement(review.proposal!.requestId)) : Promise.resolve(false),
    discardProposal: () => review.proposal ? act(() => creation.discardRefinement(review.proposal!.requestId)) : Promise.resolve(false),
    discardOrphaned: () => act(() => creation.discardOrphanedEdits(review.orphanedLessonIds)),
    finalize: (mode: 'private_activation' | 'public_publish') => canFinalize ? act(() => creation.finalize(mode)) : Promise.resolve(false),
    back: () => !dirty ? act(creation.backToMaterials) : Promise.resolve(false),
    loadOlder: async () => {
      if (pageController.current || !preview?.conversation.nextBefore || disabled) return;
      const revision = snapshot.revision; const controller = new AbortController(); pageController.current = controller;
      try {
        const page = await loadReview(snapshot.draftId, controller.signal, preview.conversation.nextBefore);
        if (controller.signal.aborted || currentRevision.current !== revision || page.revision !== revision) return;
        setLoaded(current => current?.revision === revision ? { ...current, conversation: {
          entries: [...new Map([...current.conversation.entries, ...page.conversation.entries].map(entry => [entry.id, entry])).values()], nextBefore: page.conversation.nextBefore } } : current);
      } catch { if (!controller.signal.aborted) setReadError({ revision, message: 'Older conversation could not be loaded. Retry.' }); }
      finally { if (pageController.current === controller) pageController.current = null; }
    },
  };
}
export type ReviewModel = ReturnType<typeof useReviewWorkspace>;
