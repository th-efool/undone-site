'use client';

import dynamic from 'next/dynamic';
import type { CanvasSceneData, CanvasState } from '../../models/canvas.models';
import styles from './NotesCanvas.module.css';
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HamburgerGridControls, GridSettingsConfig } from './HamburgerGridControls';

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
  const [dropdownMenuNode, setDropdownMenuNode] = useState<HTMLElement | null>(null);

  const [gridConfig, setGridConfig] = useState<GridSettingsConfig>({
    enabled: true,
    style: 'dots',
    size: 20,
    color: '#334155',
    opacity: 0.5,
  });

  const containerRef = useRef<HTMLDivElement>(null);

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
    const rawBg = appState.viewBackgroundColor;
    const viewBackgroundColor = (!rawBg || rawBg === '#ffffff') ? '#000000' : rawBg;

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

  // Apply grid config to Excalidraw API and container CSS
  const handleGridConfigChange = useCallback((newConfig: GridSettingsConfig) => {
    setGridConfig(newConfig);

    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          gridSize: newConfig.enabled ? newConfig.size : null,
        },
      });
    }
  }, [excalidrawAPI]);

  // DOM observer to inject color picker button into Hex Code input & detect Hamburger menu
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new MutationObserver(() => {
      // 1. Detect Hamburger Menu container for Portal injection
      const menu = containerRef.current?.querySelector('.dropdown-menu-container') as HTMLElement;
      if (menu && menu !== dropdownMenuNode) {
        setDropdownMenuNode(menu);
      } else if (!menu && dropdownMenuNode) {
        setDropdownMenuNode(null);
      }

      // 2. Inject visual color picker into Hex Code input box if open
      const hexContainer = containerRef.current?.querySelector('.color-picker__input-label, .color-input-container');
      if (hexContainer && !hexContainer.querySelector('.custom-native-color-picker')) {
        const hexInput = hexContainer.querySelector('input.color-picker-input') as HTMLInputElement;
        if (hexInput) {
          const picker = document.createElement('input');
          picker.type = 'color';
          picker.className = 'custom-native-color-picker';
          const val = hexInput.value.startsWith('#') ? hexInput.value : `#${hexInput.value}`;
          picker.value = val.length === 7 ? val : '#000000';
          picker.style.width = '24px';
          picker.style.height = '24px';
          picker.style.border = 'none';
          picker.style.borderRadius = '4px';
          picker.style.background = 'transparent';
          picker.style.cursor = 'pointer';
          picker.style.marginLeft = '4px';

          picker.oninput = (e: any) => {
            const chosen = e.target.value;
            hexInput.value = chosen;
            hexInput.dispatchEvent(new Event('input', { bubbles: true }));
            hexInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (excalidrawAPI) {
              excalidrawAPI.updateScene({ appState: { viewBackgroundColor: chosen } });
            }
          };

          hexContainer.appendChild(picker);
        }
      }
    });

    observer.observe(containerRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [dropdownMenuNode, excalidrawAPI]);

  const handleChange = useCallback((elements: any, appState: any, files: any) => {
    const bgColor = appState.viewBackgroundColor || '#000000';
    
    onSceneChange({
      elements,
      appState: {
        viewBackgroundColor: bgColor,
        gridSize: appState.gridSize ?? 20,
        theme: 'dark',
      },
      files,
    });
  }, [onSceneChange]);

  return (
    <div ref={containerRef} className={styles.container}>
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
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

      {/* Render Grid Controls inside Excalidraw's Hamburger Menu via Portal */}
      {dropdownMenuNode && createPortal(
        <HamburgerGridControls config={gridConfig} onChange={handleGridConfigChange} />,
        dropdownMenuNode
      )}
    </div>
  );
}
