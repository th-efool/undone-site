export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/home';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\x00-\x20]/.test(decoded.split('?')[0])) return '/home';
    const url = new URL(value, 'https://undone.invalid');
    return url.origin === 'https://undone.invalid' && url.pathname !== '/auth' ? url.pathname + url.search + url.hash : '/home';
  } catch { return '/home'; }
}
export function creationSignInUrl(returnTo: string) {
  return `/auth?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
