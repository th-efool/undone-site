import React, { useState } from 'react';
import { Palette } from 'lucide-react';
import { Slider } from '@/src/client/components/ui/Slider/Slider';
import styles from './HamburgerGridControls.module.css';

export interface GridSettingsConfig {
  enabled: boolean;
  layout: 'blank' | 'grid' | 'horizontal' | 'vertical';
  lineStyle: 'solid' | 'dashed' | 'dotted';
  size: number;
  color: string;
  opacity: number;
  strokeWidth?: number;
}

interface HamburgerGridControlsProps {
  config: GridSettingsConfig;
  onChange: (newConfig: GridSettingsConfig) => void;
  viewBackgroundColor: string;
  onBgChange: (color: string) => void;
}

const BG_PRESETS = [
  { hex: '#000000', label: 'Pitch Black' },
  { hex: '#0f172a', label: 'Deep Slate' },
  { hex: '#18181b', label: 'Dark Zinc' },
  { hex: '#1c1917', label: 'Warm Stone' },
  { hex: '#050505', label: 'OLED Black' },
];

// Custom SVGs for perfect pixel icons without relying on lucide-react mapping
const IconBlank = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>;
const IconGrid = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>;
const IconHorizontal = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18" /></svg>;
const IconVertical = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></svg>;

const IconSolid = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16" /></svg>;
const IconDashed = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h4M10 12h4M16 12h4" /></svg>;
const IconDotted = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v.01M9 12v.01M14 12v.01M19 12v.01" /></svg>;

export const HamburgerGridControls: React.FC<HamburgerGridControlsProps> = ({ 
  config, 
  onChange, 
  viewBackgroundColor, 
  onBgChange 
}) => {

  const update = (partial: Partial<GridSettingsConfig>) => {
    onChange({ ...config, ...partial });
  };

  const handleLayoutChange = (layout: GridSettingsConfig['layout']) => {
    update({ layout, enabled: layout !== 'blank' });
  };

  const handleStyleChange = (lineStyle: GridSettingsConfig['lineStyle']) => {
    update({ lineStyle });
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 5) {
      update({ size: val });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: '4px' }}>
      {/* Sleek Canvas Background Selector */}
      <div className={styles.canvasBgSection}>
        <div className={styles.excalidrawLabel}>Canvas Background</div>
        <div className={styles.colorRow}>
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              className={`${styles.colorSwatch} ${viewBackgroundColor === preset.hex ? styles.active : ''}`}
              style={{ backgroundColor: preset.hex }}
              onClick={() => onBgChange(preset.hex)}
              title={preset.label}
            />
          ))}
          <div className={styles.customPickerWrapper}>
            <input
              type="color"
              value={viewBackgroundColor === 'transparent' ? '#000000' : viewBackgroundColor}
              onChange={(e) => onBgChange(e.target.value)}
              className={styles.nativePicker}
              title="Custom Background Color"
            />
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Inline Grid Settings */}
      <div 
        className={styles.inlineGridSection}
        onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
        onPointerUp={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
        onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
        onKeyDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
      >
        {/* Grid Layout Selector */}
        <div className={styles.group}>
          <span className={styles.excalidrawLabel}>Grid Style</span>
          <div className={styles.buttonRow}>
            <button 
              className={`${styles.iconBtn} ${config.layout === 'blank' ? styles.active : ''}`}
              onClick={() => handleLayoutChange('blank')} title="Blank"
            ><IconBlank /></button>
            <button 
              className={`${styles.iconBtn} ${config.layout === 'grid' ? styles.active : ''}`}
              onClick={() => handleLayoutChange('grid')} title="Grid"
            ><IconGrid /></button>
            <button 
              className={`${styles.iconBtn} ${config.layout === 'horizontal' ? styles.active : ''}`}
              onClick={() => handleLayoutChange('horizontal')} title="Horizontal Only"
            ><IconHorizontal /></button>
            <button 
              className={`${styles.iconBtn} ${config.layout === 'vertical' ? styles.active : ''}`}
              onClick={() => handleLayoutChange('vertical')} title="Vertical Only"
            ><IconVertical /></button>
          </div>
        </div>

        {/* Line Style Selector */}
        {config.layout !== 'blank' && (
          <div className={styles.group}>
            <span className={styles.excalidrawLabel}>Line Style</span>
            <div className={styles.buttonRow}>
              <button 
                className={`${styles.iconBtn} ${config.lineStyle === 'solid' ? styles.active : ''}`}
                onClick={() => handleStyleChange('solid')} title="Solid"
              ><IconSolid /></button>
              <button 
                className={`${styles.iconBtn} ${config.lineStyle === 'dashed' ? styles.active : ''}`}
                onClick={() => handleStyleChange('dashed')} title="Dashed"
              ><IconDashed /></button>
              <button 
                className={`${styles.iconBtn} ${config.lineStyle === 'dotted' ? styles.active : ''}`}
                onClick={() => handleStyleChange('dotted')} title="Dotted"
              ><IconDotted /></button>
            </div>
          </div>
        )}

        {/* Grid Spacing Slider */}
        {config.layout !== 'blank' && (
          <div className={styles.group}>
            <div className={styles.excalidrawLabelRow}>
              <span>Spacing</span>
              <span className={styles.sliderValue}>{config.size}px</span>
            </div>
            <Slider
              className={styles.rangeSlider}
              value={config.size}
              onChange={handleSizeChange}
              min={10}
              max={100}
              step={5}
            />
          </div>
        )}

        {/* Grid Width Slider */}
        {config.layout !== 'blank' && (
          <div className={styles.group}>
            <div className={styles.excalidrawLabelRow}>
              <span>Width</span>
              <span className={styles.sliderValue}>{config.strokeWidth || 1}px</span>
            </div>
            <Slider
              className={styles.rangeSlider}
              value={config.strokeWidth || 1}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) update({ strokeWidth: val });
              }}
              min={1}
              max={5}
              step={0.5}
            />
          </div>
        )}
      </div>
    </div>
  );
};
