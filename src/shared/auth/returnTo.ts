export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/home';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\x00-\x20]/.test(decoded.split('?')[0])) return '/home';
    const url = new URL(value, 'https://undone.invalid');
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    return url.origin === 'https://undone.invalid' && pathname !== '/auth' && pathname !== '/api/auth' && !pathname.startsWith('/api/auth/') ? url.pathname + url.search + url.hash : '/home';
  } catch { return '/home'; }
}
/** Auth.js uses callbackUrl while app entry links use returnTo. */
export function authReturnTo(returnTo: unknown, callbackUrl: unknown, requestOrigin: string): string {
  if (typeof returnTo === 'string') return safeReturnTo(returnTo);
  if (typeof callbackUrl !== 'string') return '/home';
  try {
    const callback = new URL(callbackUrl, requestOrigin);
    return callback.origin === new URL(requestOrigin).origin ? safeReturnTo(callback.pathname + callback.search + callback.hash) : '/home';
  } catch { return '/home'; }
}
export function creationSignInUrl(returnTo: string) {
  return `/auth?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
