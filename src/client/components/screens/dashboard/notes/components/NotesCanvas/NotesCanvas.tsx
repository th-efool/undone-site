'use client';

import dynamic from 'next/dynamic';
import type { CanvasSceneData, CanvasState } from '../../models/canvas.models';
import styles from './NotesCanvas.module.css';
import { useMemo, useCallback } from 'react';

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
    if (!initialScene) {
      return {
        elements: [],
        appState: {
          viewBackgroundColor: '#000000',
          gridSize: 20,
          theme: 'dark',
        },
      };
    }

    const appState = initialScene.appState || {};
    // Normalize light mode default saved colors to OLED pitch black #000000
    const rawBg = appState.viewBackgroundColor;
    const viewBackgroundColor = (!rawBg || rawBg === '#ffffff' || rawBg === '#ffffff') ? '#000000' : rawBg;

    return {
      elements: initialScene.elements as any,
      appState: {
        viewBackgroundColor,
        gridSize: appState.gridSize ?? 20,
        theme: 'dark',
        ...appState,
        viewBackgroundColor,
        gridSize: appState.gridSize ?? 20,
        theme: 'dark',
      },
      files: initialScene.files as any,
    };
  }, [initialScene]);

  const handleChange = useCallback((elements: any, appState: any, files: any) => {
    const bgColor = appState.viewBackgroundColor || '#000000';
    
    onSceneChange({
      elements,
      // Preserve essential app state including background color, grid size, and theme
      appState: {
        viewBackgroundColor: bgColor,
        gridSize: appState.gridSize ?? 20,
        theme: 'dark',
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
        theme="dark"
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
