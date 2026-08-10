'use client';

import { useExperience } from './useExperience';

/**
 * Returns `true` when the current experience is mobile.
 * Delegated to `useExperience() === 'mobile'`.
 */
export function useIsMobile(): boolean {
  const experience = useExperience();
  return experience === 'mobile';
}
