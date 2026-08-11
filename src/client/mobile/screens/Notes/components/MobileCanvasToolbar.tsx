'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Pencil,
  Square,
  Circle,
  Minus,
  Type,
  ArrowUpRight,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import styles from './MobileCanvasToolbar.module.css';

type ExcalidrawTool =
  | 'selection'
  | 'freedraw'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'arrow'
  | 'hand';

interface ToolDef {
  id: ExcalidrawTool | 'undo' | 'redo' | 'delete' | 'more';
  icon: React.ReactNode;
  label: string;
}

const TOOLS: ToolDef[] = [
  { id: 'freedraw',  icon: <Pencil size={18} />,        label: 'Draw'      },
  { id: 'rectangle', icon: <Square size={18} />,         label: 'Rectangle' },
  { id: 'ellipse',   icon: <Circle size={18} />,         label: 'Ellipse'   },
  { id: 'line',      icon: <Minus size={18} />,          label: 'Line'      },
  { id: 'arrow',     icon: <ArrowUpRight size={18} />,   label: 'Arrow'     },
  { id: 'text',      icon: <Type size={18} />,           label: 'Text'      },
  { id: 'hand',      icon: <Hand size={18} />,           label: 'Pan'       },
];

const ACTIONS: ToolDef[] = [
  { id: 'undo',   icon: <Undo2 size={18} />,            label: 'Undo'   },
  { id: 'redo',   icon: <Redo2 size={18} />,            label: 'Redo'   },
  { id: 'delete', icon: <Trash2 size={18} />,           label: 'Delete' },
  { id: 'more',   icon: <SlidersHorizontal size={18} />, label: 'More'   },
];

const STROKE_WIDTHS = [1, 2, 4];
const COLOR_PRESETS = [
  '#ffffff', '#a78bfa', '#60a5fa', '#34d399',
  '#fbbf24', '#f87171', '#f472b6', '#94a3b8',
];

interface MobileCanvasToolbarProps {
  api: any;
}

export function MobileCanvasToolbar({ api }: MobileCanvasToolbarProps) {
  const [activeTool, setActiveTool] = useState<ExcalidrawTool>('freedraw');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState('#ffffff');

  // Set freedraw as default when API becomes available
  useEffect(() => {
    if (!api) return;
    try {
      api.setActiveTool({ type: 'freedraw' });
    } catch {}
  }, [api]);

  const vibrate = () => {
    try { navigator.vibrate?.(8); } catch {}
  };

  const selectTool = useCallback((tool: ExcalidrawTool) => {
    if (!api) return;
    vibrate();
    setActiveTool(tool);
    try {
      api.setActiveTool({ type: tool });
    } catch {}
  }, [api]);

  const handleAction = useCallback((id: string) => {
    if (!api) return;
    vibrate();
    try {
      if (id === 'undo') api.history.undo();
      else if (id === 'redo') api.history.redo();
      else if (id === 'delete') {
        const elements = api.getSceneElements().filter((el: any) =>
          api.getAppState().selectedElementIds[el.id]
        );
        if (elements.length > 0) {
          api.updateScene({
            elements: api.getSceneElements().map((el: any) =>
              api.getAppState().selectedElementIds[el.id]
                ? { ...el, isDeleted: true }
                : el
            ),
          });
        }
      } else if (id === 'more') {
        setSheetOpen(true);
      }
    } catch {}
  }, [api]);

  const applyStrokeWidth = useCallback((w: number) => {
    setStrokeWidth(w);
    if (!api) return;
    try {
      api.updateScene({
        appState: { currentItemStrokeWidth: w },
      });
    } catch {}
  }, [api]);

  const applyColor = useCallback((color: string) => {
    setStrokeColor(color);
    if (!api) return;
    try {
      api.updateScene({
        appState: {
          currentItemStrokeColor: color,
          currentItemBackgroundColor: 'transparent',
        },
      });
    } catch {}
  }, [api]);

  return (
    <>
      {/* Floating pill toolbar */}
      <div className={styles.toolbar}>
        {/* Drawing tools */}
        <div className={styles.toolGroup}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`${styles.toolBtn} ${activeTool === t.id ? styles.toolBtnActive : ''}`}
              onClick={() => selectTool(t.id as ExcalidrawTool)}
              aria-label={t.label}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        {/* Actions */}
        <div className={styles.toolGroup}>
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              className={styles.toolBtn}
              onClick={() => handleAction(a.id)}
              aria-label={a.label}
              title={a.label}
            >
              {a.icon}
            </button>
          ))}
        </div>
      </div>

      {/* "More" bottom sheet — stroke width + color */}
      {sheetOpen && (
        <>
          <div className={styles.sheetOverlay} onClick={() => setSheetOpen(false)} />
          <div className={styles.sheet}>
            <div className={styles.sheetHandle} />

            <div className={styles.sheetRow}>
              <button
                className={styles.sheetClose}
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className={styles.sheetLabel}>Stroke width</p>
            <div className={styles.strokeRow}>
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  className={`${styles.strokeBtn} ${strokeWidth === w ? styles.strokeBtnActive : ''}`}
                  onClick={() => applyStrokeWidth(w)}
                  aria-label={`${w}px`}
                >
                  <div
                    className={styles.strokePreview}
                    style={{ height: w * 2, background: strokeColor }}
                  />
                  <span>{w}px</span>
                </button>
              ))}
            </div>

            <p className={styles.sheetLabel}>Color</p>
            <div className={styles.colorRow}>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorSwatch} ${strokeColor === c ? styles.colorSwatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => applyColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
