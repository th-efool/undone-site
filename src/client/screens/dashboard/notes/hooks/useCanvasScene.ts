import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasAdapter, CANVAS_SCHEMA_VERSION } from '../adapters/canvas.adapter';
import { canvasRepository } from '../repositories/canvas.repository';
import type { CanvasSceneData, CanvasState } from '../models/canvas.models';

export function useCanvasScene(noteId: string | null) {
  const [initialScene, setInitialScene] = useState<CanvasSceneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    status: 'idle',
    lastSavedAt: null,
    isDirty: false,
    errorMessage: null,
  });

  const sceneRef = useRef<CanvasSceneData | null>(null);
  const isDirtyRef = useRef(false);
  const triggerRef = useRef(0);

  // Used to notify useCanvasPersistence without re-rendering the whole tree
  const [saveTrigger, setSaveTrigger] = useState(0);

  useEffect(() => {
    if (!noteId) {
      setInitialScene(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setCanvasState(s => ({ ...s, status: 'loading' }));

    canvasRepository.load(noteId).then((doc) => {
      if (!isMounted) return;
      
      let data: CanvasSceneData;
      if (doc) {
        const migrated = canvasAdapter.migrateScene(doc, doc.schemaVersion, CANVAS_SCHEMA_VERSION);
        data = canvasAdapter.deserialize(migrated.scene) || canvasAdapter.createEmptyScene();
        setCanvasState(s => ({ ...s, lastSavedAt: migrated.savedAt, status: 'saved' }));
      } else {
        data = canvasAdapter.createEmptyScene();
        setCanvasState(s => ({ ...s, status: 'idle', lastSavedAt: null }));
      }

      sceneRef.current = data;
      isDirtyRef.current = false;
      setInitialScene(data);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [noteId]);

  const handleSceneChange = useCallback((scene: CanvasSceneData) => {
    sceneRef.current = scene;
    triggerRef.current += 1;
    
    // We update the state once so UI can reflect "saving..." or "unsaved changes"
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      setCanvasState((s) => ({ ...s, isDirty: true, status: 'saving' }));
    }
    
    // Trigger persistence debounce
    setSaveTrigger(triggerRef.current);
  }, []);

  return {
    initialScene,
    setInitialScene,
    loading,
    canvasState,
    setCanvasState,
    handleSceneChange,
    sceneRef,
    isDirtyRef,
    saveTrigger,
  };
}
