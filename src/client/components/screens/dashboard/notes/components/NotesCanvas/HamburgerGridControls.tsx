import React from 'react';
import styles from './HamburgerGridControls.module.css';

export interface GridSettingsConfig {
  enabled: boolean;
  style: 'dots' | 'lines' | 'mesh';
  size: number;
  color: string;
  opacity: number;
}

interface HamburgerGridControlsProps {
  config: GridSettingsConfig;
  onChange: (newConfig: GridSettingsConfig) => void;
}

export function HamburgerGridControls({ config, onChange }: HamburgerGridControlsProps) {
  const update = (partial: Partial<GridSettingsConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className={styles.gridSection}>
      <div className={styles.sectionTitle}>Grid Settings</div>

      <div className={styles.row}>
        <span>Show Grid</span>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          style={{ cursor: 'pointer', width: 16, height: 16 }}
        />
      </div>

      {config.enabled && (
        <>
          <div className={styles.row}>
            <span>Pattern</span>
            <div className={styles.buttonGroup}>
              <button
                className={`${styles.optionBtn} ${config.style === 'dots' ? styles.active : ''}`}
                onClick={() => update({ style: 'dots' })}
              >
                Dots
              </button>
              <button
                className={`${styles.optionBtn} ${config.style === 'lines' ? styles.active : ''}`}
                onClick={() => update({ style: 'lines' })}
              >
                Lines
              </button>
              <button
                className={`${styles.optionBtn} ${config.style === 'mesh' ? styles.active : ''}`}
                onClick={() => update({ style: 'mesh' })}
              >
                Mesh
              </button>
            </div>
          </div>

          <div className={styles.row}>
            <span>Size ({config.size}px)</span>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={config.size}
              onChange={(e) => update({ size: Number(e.target.value) })}
              className={styles.slider}
            />
          </div>

          <div className={styles.row}>
            <span>Color & Opacity</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={config.color}
                onChange={(e) => update({ color: e.target.value })}
                className={styles.colorPickerInput}
                title="Choose grid color"
              />
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={config.opacity}
                onChange={(e) => update({ opacity: Number(e.target.value) })}
                className={styles.slider}
                style={{ width: 60 }}
                title="Grid opacity"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
