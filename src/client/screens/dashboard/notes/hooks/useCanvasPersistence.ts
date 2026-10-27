import { useCallback, useEffect, useRef } from 'react';
import { canvasRepository } from '../repositories/canvas.repository';
import { canvasAdapter, CANVAS_SCHEMA_VERSION } from '../adapters/canvas.adapter';
import type { CanvasSceneData, CanvasState } from '../models/canvas.models';

export function useCanvasPersistence(
  noteId: string | null,
  sceneRef: React.MutableRefObject<CanvasSceneData | null>,
  isDirtyRef: React.MutableRefObject<boolean>,
  setCanvasState: React.Dispatch<React.SetStateAction<CanvasState>>,
  saveTrigger: number,
  onSaveComplete?: () => void,
  userId?: string | null
) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousNoteId = useRef(noteId);
  const latest = useRef({ noteId, saveTrigger, onSaveComplete });

  useEffect(() => {
    latest.current = { noteId, saveTrigger, onSaveComplete };
  }, [noteId, saveTrigger, onSaveComplete]);

  useEffect(() => {
    canvasRepository.setActiveUserId(userId || 'local-user');
  }, [userId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirtyRef]);

  const persist = useCallback(async (
    targetNoteId: string,
    scene: CanvasSceneData,
    trigger: number,
    updateUi: boolean,
  ) => {
    const snapshot = structuredClone(scene);
    const serialized = canvasAdapter.serialize(snapshot);
    const now = new Date().toISOString();
    const result = await canvasRepository.save({
      noteId: targetNoteId,
      scene: serialized,
      schemaVersion: CANVAS_SCHEMA_VERSION,
      savedAt: now,
    });

    const stillCurrent =
      latest.current.noteId === targetNoteId && latest.current.saveTrigger === trigger;
    if (result.ok) {
      // Keep the legacy API as a mirror, but only after the local record and outbox commit.
      void fetch('/api/workspace/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetNoteId,
          elements: snapshot.elements,
          appState: snapshot.appState,
          files: snapshot.files,
        }),
      }).then((response) => {
        if (!response.ok) console.warn('[canvas] Legacy mirror save failed:', response.status);
      }).catch((error) => console.warn('[canvas] Legacy mirror save failed:', error));

      if (updateUi && stillCurrent) {
        isDirtyRef.current = false;
        setCanvasState((state) => ({
          ...state,
          isDirty: false,
          status: 'saved',
          lastSavedAt: now,
          errorMessage: result.trimmed ? result.reason : null,
        }));
        latest.current.onSaveComplete?.();
      }
    } else if (updateUi && stillCurrent) {
      setCanvasState((state) => ({
        ...state,
        status: 'error',
        errorMessage: result.error,
      }));
    }
  }, [isDirtyRef, setCanvasState]);

  useEffect(() => {
    const switchedNote = previousNoteId.current !== noteId;
    previousNoteId.current = noteId;
    if (!noteId || !isDirtyRef.current || switchedNote) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    const scheduledTrigger = saveTrigger;
    saveTimeout.current = setTimeout(() => {
      const scene = sceneRef.current;
      if (scene) void persist(noteId, scene, scheduledTrigger, true);
    }, 1500);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    };
  }, [noteId, saveTrigger, sceneRef, isDirtyRef, persist]);

  useEffect(() => () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    const scene = sceneRef.current;
    if (noteId && isDirtyRef.current && scene) {
      void persist(noteId, scene, latest.current.saveTrigger, false);
    }
  }, [noteId, sceneRef, isDirtyRef, persist]);
}
