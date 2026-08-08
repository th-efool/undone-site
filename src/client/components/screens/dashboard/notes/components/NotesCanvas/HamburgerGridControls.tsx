import React, { useState } from 'react';
import { Grid3X3 } from 'lucide-react';
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

const COLOR_PRESETS = [
  { hex: '#334155', label: 'Slate' },
  { hex: '#475569', label: 'Muted' },
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#ffffff', label: 'White' },
];

export function HamburgerGridControls({ config, onChange }: HamburgerGridControlsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const update = (partial: Partial<GridSettingsConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Sleek Submenu Trigger inside Hamburger Menu */}
      <button
        className={styles.menuItemTrigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className={styles.triggerLabel}>
          <Grid3X3 size={15} style={{ opacity: 0.8 }} />
          Grid Settings
        </span>
        <span className={styles.arrow}>{isOpen ? '◀' : '▶'}</span>
      </button>

      {/* Sleek Submenu Flyout */}
      {isOpen && (
        <div className={styles.submenuFlyout}>
          <div className={styles.flyoutHeader}>
            <span>Grid Options</span>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          {/* Grid Toggle */}
          <div className={styles.group}>
            <div className={styles.groupLabel}>Grid Display</div>
            <div className={styles.pillRow}>
              <button
                className={`${styles.pill} ${!config.enabled ? styles.active : ''}`}
                onClick={() => update({ enabled: false })}
              >
                OFF
              </button>
              <button
                className={`${styles.pill} ${config.enabled ? styles.active : ''}`}
                onClick={() => update({ enabled: true })}
              >
                ON
              </button>
            </div>
          </div>

          {config.enabled && (
            <>
              {/* Pattern Style */}
              <div className={styles.group}>
                <div className={styles.groupLabel}>Pattern</div>
                <div className={styles.pillRow}>
                  <button
                    className={`${styles.pill} ${config.style === 'dots' ? styles.active : ''}`}
                    onClick={() => update({ style: 'dots' })}
                  >
                    • Dots
                  </button>
                  <button
                    className={`${styles.pill} ${config.style === 'lines' ? styles.active : ''}`}
                    onClick={() => update({ style: 'lines' })}
                  >
                    ─ Lines
                  </button>
                  <button
                    className={`${styles.pill} ${config.style === 'mesh' ? styles.active : ''}`}
                    onClick={() => update({ style: 'mesh' })}
                  >
                    ▦ Mesh
                  </button>
                </div>
              </div>

              {/* Grid Spacing */}
              <div className={styles.group}>
                <div className={styles.groupLabel}>Spacing</div>
                <div className={styles.pillRow}>
                  {[10, 20, 30, 40].map((sz) => (
                    <button
                      key={sz}
                      className={`${styles.pill} ${config.size === sz ? styles.active : ''}`}
                      onClick={() => update({ size: sz })}
                    >
                      {sz}px
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div className={styles.group}>
                <div className={styles.groupLabel}>Color Tint</div>
                <div className={styles.colorRow}>
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      className={`${styles.colorSwatch} ${config.color === preset.hex ? styles.active : ''}`}
                      style={{ backgroundColor: preset.hex }}
                      onClick={() => update({ color: preset.hex })}
                      title={preset.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => update({ color: e.target.value })}
                    className={styles.nativePicker}
                    title="Custom Color"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
