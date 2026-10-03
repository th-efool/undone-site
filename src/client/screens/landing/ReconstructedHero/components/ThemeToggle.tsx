'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/src/client/hooks/useTheme';
import styles from '../ReconstructedHero.module.css';

export function ThemeToggle() {
  const { isDark, toggleTheme, mounted } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={styles.themeToggleBtn}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {mounted && isDark ? (
        <Sun size={17} strokeWidth={2.2} className={styles.themeIconSun} />
      ) : (
        <Moon size={17} strokeWidth={2.2} className={styles.themeIconMoon} />
      )}
    </button>
  );
}
