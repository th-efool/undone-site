'use client';

import React from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import type { BackgroundId } from '../../types';
import { BACKGROUND_OPTIONS } from '../../data/backgroundCatalog';
import styles from './BackgroundTab.module.css';

export interface BackgroundTabProps {
  selectedId: BackgroundId;
  onSelect: (id: BackgroundId) => void;
}

export function BackgroundTab({ selectedId, onSelect }: BackgroundTabProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Room background"
      className={styles.grid}
    >
      {BACKGROUND_OPTIONS.map((opt) => {
        const isSelected = selectedId === opt.id;
        const titleText = opt.image ? opt.label : 'Illustration coming soon';

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
  );
}

export default BackgroundTab;
