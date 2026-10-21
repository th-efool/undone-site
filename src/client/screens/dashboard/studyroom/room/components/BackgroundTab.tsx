'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import type { BackgroundId } from '../../types';
import { SCENE_BACKGROUNDS, SOLID_BACKGROUNDS } from '../../data/backgroundCatalog';
import styles from './BackgroundTab.module.css';

export interface BackgroundTabProps {
  selectedId: BackgroundId;
  onSelect: (id: BackgroundId) => void;
}

export function BackgroundTab({ selectedId, onSelect }: BackgroundTabProps) {
  const [showColors, setShowColors] = useState(() => SOLID_BACKGROUNDS.some((bg) => bg.id === selectedId));
  return (
    <div>
      <div className={styles.modeSwitch} aria-label="Background style">
        <button type="button" aria-pressed={!showColors} onClick={() => setShowColors(false)}>Scenes</button>
        <button type="button" aria-pressed={showColors} onClick={() => setShowColors(true)}>Solid colors</button>
      </div>
    <div
      role="radiogroup"
      aria-label="Room background"
      className={styles.grid}
    >
      {(showColors ? SOLID_BACKGROUNDS : SCENE_BACKGROUNDS).map((opt) => {
        const isSelected = selectedId === opt.id;
        const titleText = opt.label;

        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={titleText}
            className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
            onClick={() => onSelect(opt.id)}
          >
            <div
              className={styles.thumbnail}
              style={{ background: opt.gradient }}
            >
              {opt.image && (
                <Image
                  src={opt.image}
                  alt=""
                  fill
                  sizes="160px"
                  style={{ objectFit: 'cover', objectPosition: opt.focal }}
                  className={styles.thumbnailImage}
                />
              )}
              {isSelected && (
                <div className={styles.checkBadge} aria-hidden="true">
                  <Check size={12} />
                </div>
              )}
            </div>
            <span className={styles.label}>{opt.label}</span>
          </button>
        );
      })}
    </div>
    </div>
  );
}

export default BackgroundTab;
