import React, { useEffect } from 'react';
import { Grid, Grid3X3 } from 'lucide-react';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
import styles from './CanvasControls.module.css';

const PRESET_COLORS = [
  { hex: '#000000', name: 'Pitch Black' },
  { hex: '#191919', name: 'Notion Charcoal' },
  { hex: '#171717', name: 'Deep Graphite' },
  { hex: '#1E1E1E', name: 'Editor Slate' },
  { hex: '#0F172A', name: 'Midnight Navy' }
];

interface CanvasControlsProps {
  currentBackgroundColor: string;
  isGridEnabled: boolean;
  onBackgroundChange: (color: string) => void;
  onGridToggle: () => void;
}

export function CanvasControls({
  currentBackgroundColor,
  isGridEnabled,
  onBackgroundChange,
  onGridToggle
}: CanvasControlsProps) {

  // Keyboard shortcut for grid toggle (Ctrl/Cmd + ')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle grid with Ctrl/Cmd + '
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault();
        onGridToggle();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onGridToggle]);

  return (
    <div className={styles.controlsContainer}>
      <div className={styles.colorPicker}>
        {PRESET_COLORS.map((color) => (
          <Tooltip key={color.hex} content={color.name} placement="top">
            <button
              className={`${styles.colorSwatch} ${currentBackgroundColor === color.hex ? styles.active : ''}`}
              style={{ backgroundColor: color.hex }}
              onClick={() => onBackgroundChange(color.hex)}
              aria-label={`Change background to ${color.name}`}
            />
          </Tooltip>
        ))}
      </div>
      
      <div className={styles.divider} />
      
      <Tooltip 
        content={<>Toggle grid <kbd style={{ fontFamily: 'inherit', padding: '2px 4px', background: '#3f3f46', borderRadius: '4px', fontSize: '10px', marginLeft: '4px' }}>⌘'</kbd></>} 
        placement="top"
      >
        <button
          className={`${styles.gridToggle} ${isGridEnabled ? styles.active : ''}`}
          onClick={onGridToggle}
          aria-label="Toggle grid"
        >
          <Grid3X3 size={18} />
        </button>
      </Tooltip>
    </div>
  );
}
