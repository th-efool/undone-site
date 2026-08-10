'use client';

import { useEffect, useState } from 'react';
import { isNativeApp } from '@/src/client/utils/isNative';

export type Experience = 'desktop' | 'mobile';

const MOBILE_BREAKPOINT = 768;

/**
 * Single SSR-safe experience hook returning `'desktop' | 'mobile'`.
 *
 * SSR-safe: returns `'desktop'` on the server and during initial hydration
 * so the initial DOM matches. Once mounted, detects if running inside a Capacitor
 * native application (`isNativeApp()`) or viewport width is ≤ 768px.
 */
export function useExperience(): Experience {
  const [experience, setExperience] = useState<Experience>('desktop');

  useEffect(() => {
    const updateExperience = () => {
      if (isNativeApp()) {
        setExperience('mobile');
        return;
      }
      const isMobileWidth = window.innerWidth <= MOBILE_BREAKPOINT;
      setExperience(isMobileWidth ? 'mobile' : 'desktop');
    };

    updateExperience();

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = () => updateExperience();

    mql.addEventListener('change', handler);
    window.addEventListener('resize', handler);

    return () => {
      mql.removeEventListener('change', handler);
      window.removeEventListener('resize', handler);
    };
  }, []);

  return experience;
}
