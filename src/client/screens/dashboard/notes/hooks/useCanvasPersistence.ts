import { useEffect, useRef } from 'react';
import { canvasRepository } from '../repositories/canvas.repository';
import { canvasAdapter, CANVAS_SCHEMA_VERSION } from '../adapters/canvas.adapter';
import type { CanvasState, CanvasSceneData } from '../models/canvas.models';

export function useCanvasPersistence(
  noteId: string | null,
  sceneRef: React.MutableRefObject<CanvasSceneData | null>,
  isDirtyRef: React.MutableRefObject<boolean>,
  setCanvasState: React.Dispatch<React.SetStateAction<CanvasState>>,
  saveTrigger: number,
  onSaveComplete?: () => void
) {
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Before unloading, warn if there are unsaved changes
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!noteId || !isDirtyRef.current) return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(async () => {
      if (!sceneRef.current || !noteId) return;

      const serialized = canvasAdapter.serialize(sceneRef.current);
      const now = new Date().toISOString();

      const result = await canvasRepository.save({
        noteId,
        scene: serialized,
        schemaVersion: CANVAS_SCHEMA_VERSION,
        savedAt: now,
      });

      if (result.ok) {
        isDirtyRef.current = false;
        if (result.trimmed) {
          // Partial save — elements saved, some images were stripped
          setCanvasState((s) => ({
            ...s,
            isDirty: false,
            status: 'saved',
            lastSavedAt: now,
            errorMessage: result.reason, // surfaced in the UI as a warning
          }));
        } else {
          setCanvasState((s) => ({
            ...s,
            isDirty: false,
            status: 'saved',
            lastSavedAt: now,
            errorMessage: null,
          }));
        }
        if (onSaveComplete) onSaveComplete();
      } else {
        setCanvasState((s) => ({
          ...s,
          status: 'error',
          errorMessage: result.error,
        }));
      }
    }, 1500);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);

        if (isDirtyRef.current && sceneRef.current && noteId) {
          // Emergency backup first (sync, never throws) — belt-and-suspenders
          canvasRepository.saveImmediate(noteId, sceneRef.current, CANVAS_SCHEMA_VERSION);

          // Then attempt a proper primary save (with partial-save fallback built in)
          const serialized = canvasAdapter.serialize(sceneRef.current);
          canvasRepository.save({
            noteId,
            scene: serialized,
            schemaVersion: CANVAS_SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
          }).catch(err => console.error('Failed to save on unmount:', err));
        }
      }
    };
  }, [noteId, saveTrigger]);
}
