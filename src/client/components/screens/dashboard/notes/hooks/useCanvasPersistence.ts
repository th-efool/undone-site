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
    // Before unloading, warn if there's an error and it's dirty
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
      
      try {
        const serialized = canvasAdapter.serialize(sceneRef.current);
        const now = new Date().toISOString();
        
        await canvasRepository.save({
          noteId,
          scene: serialized,
          schemaVersion: CANVAS_SCHEMA_VERSION,
          savedAt: now,
        });

        isDirtyRef.current = false;
        setCanvasState((s) => ({
          ...s,
          isDirty: false,
          status: 'saved',
          lastSavedAt: now,
          errorMessage: null,
        }));
        
        if (onSaveComplete) onSaveComplete();
      } catch (err) {
        setCanvasState((s) => ({
          ...s,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Save failed',
        }));
      }
    }, 1500);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        // Synchronous fire-and-forget save before unmount
        if (isDirtyRef.current && sceneRef.current && noteId) {
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
  }, [noteId, saveTrigger]); // re-run debounce every time saveTrigger changes
}
