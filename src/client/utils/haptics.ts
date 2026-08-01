'use client';

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (typeof window === 'undefined') return;

  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      switch (style) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(22);
          break;
        case 'heavy':
          navigator.vibrate(40);
          break;
        case 'success':
          navigator.vibrate([12, 30, 12]);
          break;
        case 'warning':
          navigator.vibrate([25, 40, 25]);
          break;
      }
    }
  } catch {
    // Ignore unsupported browser environments gracefully
  }
}
