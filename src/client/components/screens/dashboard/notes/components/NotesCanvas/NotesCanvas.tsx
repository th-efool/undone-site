'use client';

import dynamic from 'next/dynamic';
import type { CanvasSceneData, CanvasState } from '../../models/canvas.models';
import styles from './NotesCanvas.module.css';
import { useMemo, useCallback, useState, useEffect } from 'react';
import { canvasAdapter } from '../../adapters/canvas.adapter';
import { CanvasControls } from './CanvasControls';

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
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [currentBackgroundColor, setCurrentBackgroundColor] = useState<string>('#000000');
  const [isGridEnabled, setIsGridEnabled] = useState<boolean>(true);

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
    return {
      elements: initialScene.elements as any,
      appState: {
        viewBackgroundColor: '#000000',
        gridSize: 20,
        theme: 'dark',
        ...(initialScene.appState as any),
      },
      files: initialScene.files as any,
    };
  }, [initialScene]);

  const handleChange = useCallback((elements: any, appState: any, files: any) => {
    const bgColor = appState.viewBackgroundColor || '#000000';
    const grid = appState.gridSize !== null;
    
    if (currentBackgroundColor !== bgColor) setCurrentBackgroundColor(bgColor);
    if (isGridEnabled !== grid) setIsGridEnabled(grid);

    onSceneChange({
      elements,
      // Only preserve essential app state to minimize serialized data
      appState: {
        viewBackgroundColor: bgColor,
        gridSize: appState.gridSize,
        theme: 'dark',
      },
      files,
    });
  }, [onSceneChange, currentBackgroundColor, isGridEnabled]);

  const handleBackgroundChange = useCallback((color: string) => {
    if (!excalidrawAPI) return;
    excalidrawAPI.updateScene({ appState: { viewBackgroundColor: color } });
  }, [excalidrawAPI]);

  const handleGridToggle = useCallback(() => {
    if (!excalidrawAPI) return;
    excalidrawAPI.updateScene({ appState: { gridSize: isGridEnabled ? null : 20 } });
  }, [excalidrawAPI, isGridEnabled]);

  return (
    <div className={styles.container}>
      <Excalidraw
        excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={handleChange}
        viewModeEnabled={isReadOnly}
        theme="dark" // Switched to dark theme for Notes dashboard
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: true,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            saveAsImage: true,
          },
        }}
      />
      {!isReadOnly && (
        <CanvasControls
          currentBackgroundColor={currentBackgroundColor}
          isGridEnabled={isGridEnabled}
          onBackgroundChange={handleBackgroundChange}
          onGridToggle={handleGridToggle}
        />
      )}
    </div>
  );
}
