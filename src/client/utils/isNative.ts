/**
 * Detects if the current runtime environment is inside the Capacitor Android native app shell.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}
