'use client';

import React, { useId } from 'react';
import styles from './ConeSlider.module.css';

interface ConeSliderProps {
  value: number; // 0 to 100
  onChange: (value: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export function ConeSlider({
  value,
  onChange,
  ariaLabel = 'Volume level',
  disabled = false,
}: ConeSliderProps) {
  const clipId = useId();
  const clamped = Math.min(100, Math.max(0, value));

  // In viewBox 0 0 100 16:
  // Cone `<` shape: left tip around x=4, right mouth around x=95.
  // Thumb travel distance is from x=5 (0%) to x=94 (100%).
  const thumbX = 5 + (clamped / 100) * 89;

  return (
    <div className={styles.container}>
      <svg
        className={styles.svg}
        viewBox="0 0 100 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={`${clamped}%`} height="16" />
          </clipPath>
        </defs>

        {/* Unfilled track: subtle dark grey cone `<` tapering to point on left, opening to mouth on right */}
        <path
          d="M 4 7 C 3 7.4 3 8.6 4 9 L 93 13.5 Q 96 13.5 96 11.5 L 96 4.5 Q 96 2.5 93 2.5 Z"
          fill="rgba(255, 255, 255, 0.22)"
        />

        {/* Filled track: vibrant purple cone `<` clipped to current volume percentage */}
        <path
          d="M 4 7 C 3 7.4 3 8.6 4 9 L 93 13.5 Q 96 13.5 96 11.5 L 96 4.5 Q 96 2.5 93 2.5 Z"
          fill="#5430FF"
          clipPath={`url(#${clipId})`}
        />

        {/* Circular White Thumb Knob */}
        <circle
          cx={thumbX}
          cy="8"
          r="5.5"
          fill="#FFFFFF"
          filter="drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6))"
        />
      </svg>

      <input
        type="range"
        className={styles.rangeInput}
        min={0}
        max={100}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      />
    </div>
  );
}
