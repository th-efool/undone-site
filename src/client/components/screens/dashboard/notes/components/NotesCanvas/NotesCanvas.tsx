'use client';

import dynamic from 'next/dynamic';
import type { CanvasSceneData, CanvasState } from '../../models/canvas.models';
import styles from './NotesCanvas.module.css';
import { useMemo, useCallback } from 'react';
import { canvasAdapter } from '../../adapters/canvas.adapter';

import '@/src/app/styles/excalidraw.css';

// Dynamically import Excalidraw so it only loads on the client
// @ts-ignore - Excalidraw types can be missing in some setups
const ExcalidrawComponent = dynamic(
  // @ts-ignore
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

const Excalidraw = ExcalidrawComponent as any;

interface NotesCanvasProps {
  noteId: string;
  initialScene: CanvasSceneData | null;
  onSceneChange: (scene: CanvasSceneData) => void;
  isReadOnly?: boolean;
  canvasStatus?: CanvasState;
}

export function NotesCanvas({
  noteId,
  initialScene,
  onSceneChange,
  isReadOnly = false,
}: NotesCanvasProps) {
  // Convert internal CanvasSceneData into Excalidraw's initialData prop format
  const initialData = useMemo(() => {
    if (!initialScene) return undefined;
    return {
      elements: initialScene.elements as any,
      appState: initialScene.appState as any,
      files: initialScene.files as any,
    };
  }, [initialScene]);

  const handleChange = useCallback((elements: any, appState: any, files: any) => {
    onSceneChange({
      elements,
      // Only preserve essential app state to minimize serialized data
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        theme: 'light', // Pin theme to light as per SideQuestHQ spec
      },
      files,
    });
  }, [onSceneChange]);

  return (
    <div className={styles.container}>
      <Excalidraw
        initialData={initialData}
        onChange={handleChange}
        viewModeEnabled={isReadOnly}
        theme="light" // SideQuestHQ is light-only
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: true,
            clearCanvas: true,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            saveAsImage: true,
          },
        }}
      />
    </div>
  );
}
