const DEFAULT_API_ORIGIN = 'https://sidequesthq.com';

/**
 * Resolves API paths for web (same-origin) and Capacitor static builds (remote origin).
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/$/, '');

  if (origin) {
    return `${origin}${normalizedPath}`;
  }

  if (process.env.NEXT_PUBLIC_MOBILE_BUILD === 'true') {
    return `${DEFAULT_API_ORIGIN}${normalizedPath}`;
  }

  return normalizedPath;
}
