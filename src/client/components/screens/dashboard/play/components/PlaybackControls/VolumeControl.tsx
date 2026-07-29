'use client';

import { useState } from 'react';
import { Volume2 } from 'lucide-react';

import styles from './VolumeControl.module.css';

interface VolumeControlProps {
  volume?: number;
  onChange?: (value: number) => void;
}

export function VolumeControl({ volume = 95, onChange }: VolumeControlProps) {
  const [currentVolume, setCurrentVolume] = useState(volume);

  function handleChange(value: number) {
    setCurrentVolume(value);
    onChange?.(value);
  }

  return (
    <div className={styles.root}>
      <button
        className={styles.button}
        aria-label="Volume"
      >
        <Volume2 size={18} />
      </button>

      <div className={styles.slider}>
        <input
          type="range"
          min={0}
          max={100}
          value={currentVolume}
          onChange={(event) => handleChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
