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
  /** Mobile: skip desktop panning, enable zen mode, expose API for toolbar */
  isMobile?: boolean;
  /** Called once when Excalidraw API is ready — used by MobileCanvasToolbar */
  onApiReady?: (api: any) => void;
}

// Minimal color inversion to counteract Excalidraw's global CSS invert(93%) filter.
// Minimal color inversion to counteract Excalidraw's global CSS invert(93%) filter.
function invertHex(hex: string) {
  if (!hex || !hex.startsWith('#')) return hex;
  let normalized = hex.toLowerCase();
  
  if (normalized.length === 4) {
    normalized = '#' + normalized.split('').slice(1).map(c => c + c).join('');
  }
  if (normalized.length !== 7) return hex;

  // We exclusively use HSL lightness inversion.
  // This guarantees that the hue is perfectly preserved when passed through Excalidraw's
  // `invert(0.93) hue-rotate(180deg)` CSS filter. The lightness will be clamped naturally
  // by the 0.93 factor, which is the intended design for Excalidraw Dark Mode.
  let r = parseInt(normalized.slice(1, 3), 16) / 255;
  let g = parseInt(normalized.slice(3, 5), 16) / 255;
  let b = parseInt(normalized.slice(5, 7), 16) / 255;
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  l = 1 - l; // Invert lightness

  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1/3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hexStr = Math.round(x * 255).toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  };
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

export function NotesCanvas({
  noteId,
  initialScene,
  onSceneChange,
  isReadOnly = false,
  isMobile = false,
  onApiReady,
}: NotesCanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Expose API to parent (MobileCanvasToolbar) once ready
  const handleApiReady = useCallback((api: any) => {
    setExcalidrawAPI(api);
    onApiReady?.(api);
  }, [onApiReady]);

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
    const dashArray = config.lineStyle === 'dashed' ? '4,4' : config.lineStyle === 'dotted' ? '1,4' : 'none';
    const strokeLinecap = config.lineStyle === 'dotted' ? 'round' : 'square';
    
    let paths = '';
    let svgWidth = scaledSize;
    let svgHeight = scaledSize;

    if (config.layout === 'horizontal') {
      paths = `<path d="M 0 ${scaledSize} L ${scaledSize} ${scaledSize}" fill="none" stroke="${color}" stroke-width="${config.strokeWidth || 1}" stroke-dasharray="${dashArray}" stroke-linecap="${strokeLinecap}"/>`;
    } else if (config.layout === 'vertical') {
      paths = `<path d="M ${scaledSize} 0 L ${scaledSize} ${scaledSize}" fill="none" stroke="${color}" stroke-width="${config.strokeWidth || 1}" stroke-dasharray="${dashArray}" stroke-linecap="${strokeLinecap}"/>`;
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



  // Handle right-click drag panning (desktop-only — mobile uses two-finger pan natively)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !excalidrawAPI) return;
    // Skip on mobile: right-click doesn't exist, and this listener can
    // interfere with Excalidraw's own pointer capture for drawing.
    if (isMobile) return;

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

    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    container.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      container.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, [excalidrawAPI, isMobile]);

  // Mobile: after API ready + elements loaded, scroll to content so drawings are visible
  useEffect(() => {
    if (!isMobile || !excalidrawAPI) return;
    const timer = setTimeout(() => {
      try {
        const elements = excalidrawAPI.getSceneElements();
        if (elements && elements.length > 0) {
          excalidrawAPI.scrollToContent(elements, { animate: false, fitToContent: true });
        }
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [isMobile, excalidrawAPI]);

  // Fired when the user draws on the canvas or changes state inside Excalidraw
  const handleChange = useCallback((elements: any, appState: any, files: any) => {

    // High performance DOM mutation for grid sync (bypassing React render)
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
      {/* We pass theme="light" so Excalidraw DOES NOT invert background colors! 
          Our excalidraw.css keeps the UI 100% dark mode. */}
      <ExcalidrawWrapper
        excalidrawAPI={handleApiReady}
        initialData={initialData}
        onChange={handleChange}
        viewModeEnabled={isReadOnly}
        theme="light"
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
        isMobile={isMobile}
      />
    </div>
  );
}
