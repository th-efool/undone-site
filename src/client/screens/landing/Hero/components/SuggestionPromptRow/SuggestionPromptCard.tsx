'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './SuggestionPromptRow.module.css';

export type PromptColorScheme = 'rose' | 'purple' | 'blue' | 'cyan';

export interface SuggestionPromptCardProps {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  text: string;
  colorScheme: PromptColorScheme;
  onClick: () => void;
}

const COLOR_CLASSES: Record<PromptColorScheme, string> = {
  rose: styles.iconRose,
  purple: styles.iconPurple,
  blue: styles.iconBlue,
  cyan: styles.iconCyan,
};

export function SuggestionPromptCard({
  icon: Icon,
  text,
  colorScheme,
  onClick,
}: SuggestionPromptCardProps) {
  const colorClass = COLOR_CLASSES[colorScheme] || styles.iconBlue;

  return (
    <button
      type="button"
      className={styles.promptCard}
      onClick={onClick}
      aria-label={`Prompt: ${text}`}
    >
      <div className={`${styles.iconContainer} ${colorClass}`} aria-hidden="true">
        <Icon size={18} strokeWidth={2.1} />
      </div>

      <div className={styles.textWrapper}>
        <p className={styles.promptText}>“{text}”</p>
      </div>

      <div className={styles.actionAffordance} aria-hidden="true">
        <ArrowRight size={15} strokeWidth={2.3} />
      </div>
    </button>
  );
}
