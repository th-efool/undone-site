'use client';

import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
import { Slider } from '@/src/client/components/ui/Slider/Slider';

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

  const tooltipText = currentVolume === 0 ? 'Unmute' : 'Mute';

  return (
    <div className={styles.root}>
      <Tooltip content={tooltipText} placement="top">
        <button
          className={styles.button}
          aria-label={tooltipText}
        >
          <Volume2 size={18} />
        </button>
      </Tooltip>

      <div className={styles.slider}>
        <Slider
          min={0}
          max={100}
          value={currentVolume}
          onChange={(event) => handleChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

