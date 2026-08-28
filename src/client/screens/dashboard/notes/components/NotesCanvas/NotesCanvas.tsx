'use client';

import dynamic from 'next/dynamic';
import type { CanvasSceneData, CanvasState } from '../../models/canvas.models';
import styles from './NotesCanvas.module.css';
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { GridSettingsConfig } from './HamburgerGridControls';

import '@/src/app/styles/excalidraw.css';

// Dynamically import our wrapper so it only loads on the client
const ExcalidrawWrapper = dynamic(
  () => import('./ExcalidrawWrapper'),
  { ssr: false }
);

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

  const [gridConfig, setGridConfig] = useState<GridSettingsConfig>({
    enabled: true,
    layout: 'grid',
    lineStyle: 'dotted',
    size: 20,
    color: '#334155',
    opacity: 0.5,
  });

  const gridConfigRef = useRef(gridConfig);
  useEffect(() => { gridConfigRef.current = gridConfig; }, [gridConfig]);

  const gridOverlayRef = useRef<HTMLDivElement>(null);

  // Extract the real DB background color on mount
  const initialRealBg = useMemo(() => {
    const raw = initialScene?.appState?.viewBackgroundColor;
    return (!raw || raw === '#ffffff') ? '#000000' : raw;
  }, [initialScene]);

  const [currentBg, setCurrentBg] = useState<string>(initialRealBg);

  const containerRef = useRef<HTMLDivElement>(null);

  const initialData = useMemo(() => {
    if (!initialScene) {
      return {
        elements: [],
        appState: {
          viewBackgroundColor: "transparent",
          gridSize: gridConfigRef.current.layout === 'grid' ? gridConfigRef.current.size : null,
          gridModeEnabled: gridConfigRef.current.layout === 'grid',
          currentItemTextAlign: "left",
        },
      };
    }

    const { collaborators, ...restAppState } = (initialScene.appState as any) || {};
    return {
      elements: initialScene.elements as any,
      appState: {
        ...restAppState,
        viewBackgroundColor: "transparent",
        gridSize: gridConfigRef.current.layout === 'grid' ? gridConfigRef.current.size : null,
        gridModeEnabled: gridConfigRef.current.layout === 'grid',
        currentItemTextAlign: "left",
      },
      files: initialScene.files as any,
    };
  }, [initialScene, initialRealBg]);

  // Apply grid config to Excalidraw API
  const handleGridConfigChange = useCallback((newConfig: GridSettingsConfig) => {
    setGridConfig(newConfig);
    gridConfigRef.current = newConfig;

    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          gridModeEnabled: newConfig.layout === 'grid',
          gridSize: newConfig.layout === 'grid' ? newConfig.size : null,
        },
      });
      // Trigger a handleChange to immediately paint the new grid
      const currentApp = excalidrawAPI.getAppState();
      if (gridOverlayRef.current) {
        paintCustomGrid(currentApp, newConfig);
      }
    }
  }, [excalidrawAPI]);

  // Helper to paint the grid directly to the DOM for max performance
  const paintCustomGrid = (appState: any, config: GridSettingsConfig) => {
    if (!gridOverlayRef.current) return;
    
    const zoom = appState.zoom?.value || 1;
    const scrollX = appState.scrollX || 0;
    const scrollY = appState.scrollY || 0;

    if (config.layout === 'blank' || config.layout === 'grid' || !config.enabled) {
      gridOverlayRef.current.style.backgroundImage = 'none';
      return;
    }

    gridOverlayRef.current.style.backgroundPosition = `${scrollX * zoom}px ${scrollY * zoom}px`;
    
    const scaledSize = config.size * zoom;
    const color = 'rgba(255, 255, 255, 0.08)'; // Subtle grid for dark mode
    
    let paths = '';
    let svgWidth = scaledSize;
    let svgHeight = scaledSize;

    if (config.layout === 'horizontal') {
      paths = `<path d="M 0 ${scaledSize} L ${scaledSize} ${scaledSize}" fill="none" stroke="${color}" stroke-width="${config.strokeWidth || 1}"/>`;
    } else if (config.layout === 'vertical') {
      paths = `<path d="M ${scaledSize} 0 L ${scaledSize} ${scaledSize}" fill="none" stroke="${color}" stroke-width="${config.strokeWidth || 1}"/>`;
    }

    const encodedSVG = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">${paths}</svg>`);
    gridOverlayRef.current.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodedSVG}")`;
    gridOverlayRef.current.style.backgroundSize = `${svgWidth}px ${svgHeight}px`;
  };

  // Handle custom background change from our injected UI
  const handleBgChange = useCallback((color: string) => {
    setCurrentBg(color);
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          viewBackgroundColor: "transparent"
        }
      });
    }
  }, [excalidrawAPI]);

  // Right-click drag panning for desktop mouse users
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !excalidrawAPI) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialScrollX = 0;
    let initialScrollY = 0;
    let hasMoved = false;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 2) {
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        const appState = excalidrawAPI.getAppState();
        initialScrollX = appState.scrollX || 0;
        initialScrollY = appState.scrollY || 0;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.hypot(dx, dy) > 2) {
        hasMoved = true;
      }

      if (hasMoved) {
        document.body.style.cursor = 'grabbing';
        container.style.cursor = 'grabbing';

        const appState = excalidrawAPI.getAppState();
        const zoom = appState.zoom?.value || 1;

        const newScrollX = initialScrollX + dx / zoom;
        const newScrollY = initialScrollY + dy / zoom;

        excalidrawAPI.updateScene({
          appState: {
            scrollX: newScrollX,
            scrollY: newScrollY,
          },
        });

        if (gridOverlayRef.current) {
          paintCustomGrid({ ...appState, scrollX: newScrollX, scrollY: newScrollY }, gridConfigRef.current);
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        if (isDragging && hasMoved) {
          document.body.style.cursor = '';
          container.style.cursor = '';
        }
        isDragging = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
      }
    };

    const handleGifUpload = (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;
        
        const appState = excalidrawAPI.getAppState();
        const zoom = appState.zoom?.value || 1;
        const id = Math.random().toString(36).substring(2, 9);
        
        const newElement = {
          type: 'embeddable',
          id: id,
          x: appState.scrollX + (window.innerWidth / 2) / zoom - 200,
          y: appState.scrollY + (window.innerHeight / 2) / zoom - 150,
          width: 400,
          height: 300,
          link: dataUrl,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1000000),
          isDeleted: false,
          groupIds: [],
          boundElements: null,
          updated: Date.now(),
          backgroundColor: "transparent",
          strokeColor: "transparent",
          fillStyle: "hachure",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
        };
        
        excalidrawAPI.updateScene({
          elements: [...excalidrawAPI.getSceneElements(), newElement]
        });
      };
      reader.readAsDataURL(file);
    };

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type === 'image/gif') {
          e.preventDefault();
          e.stopPropagation();
          const file = item.getAsFile();
          if (file) handleGifUpload(file);
          return;
        }
      }
    };

    const handleDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        if (file.type === 'image/gif') {
          e.preventDefault();
          e.stopPropagation();
          handleGifUpload(file);
          return;
        }
      }
    };

    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    container.addEventListener('contextmenu', handleContextMenu, { capture: true });
    container.addEventListener('paste', handlePaste as any, { capture: true });
    container.addEventListener('drop', handleDrop as any, { capture: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      container.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      container.removeEventListener('paste', handlePaste as any, { capture: true });
      container.removeEventListener('drop', handleDrop as any, { capture: true });
    };
  }, [excalidrawAPI]);

  // Fired when the user draws on the canvas or changes state inside Excalidraw
  const handleChange = useCallback((elements: any, appState: any, files: any) => {
    paintCustomGrid(appState, gridConfigRef.current);
    
    const { collaborators, ...restAppState } = appState;
    
    onSceneChange({
      elements,
      appState: {
        ...restAppState,
        viewBackgroundColor: currentBg,
      },
      files,
    });
  }, [onSceneChange, currentBg]);

  return (
    <div ref={containerRef} className={styles.container} style={{ backgroundColor: currentBg }}>
      <div 
        ref={gridOverlayRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
        }}
      />
      <ExcalidrawWrapper
        excalidrawAPI={setExcalidrawAPI}
        initialData={initialData}
        onChange={handleChange}
        viewModeEnabled={isReadOnly}
        theme="dark"
        UIOptions={useMemo(() => ({
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: true,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            saveAsImage: true,
          },
        }), [])}
        hamburgerProps={useMemo(() => ({
          config: gridConfig,
          onChange: handleGridConfigChange,
          viewBackgroundColor: currentBg,
          onBgChange: handleBgChange,
        }), [gridConfig, handleGridConfigChange, currentBg, handleBgChange])}
      />
    </div>
  );
}
