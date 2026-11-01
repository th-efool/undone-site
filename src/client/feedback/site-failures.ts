import { devLogger } from '@/src/shared/lib/dev-logger';
export const failureMessages = {
  "data": "Could not refresh this view. Previously loaded content remains available.",
  "home": "Could not save that home change. Check the current state before retrying.",
  "feed": "Could not load more lessons. Your current lesson is kept.",
  "completion": "Could not confirm progress was saved. Retry saving when ready.",
  "notesLocal": "Could not save changes on this device. Keep this tab open and export a recovery copy.",
  "notesSync": "Cloud sync needs attention. Keep your local work and review the sync controls.",
  "message": "Could not complete that messaging action. Your saved messages remain available.",
  "room": "Could not confirm that room action. Check its current state before retrying.",
  "auth": "Sign-in is unavailable. Your form is kept; please retry.",
  "join": "Could not confirm membership. Check the cohort before retrying.",
  "github": "Could not complete the repository connection. Your notes remain on this device."
} as const;
export type FailureCode = keyof typeof failureMessages;
export type SiteFailure = { code: FailureCode; message: string };
const listeners = new Set<(failure: SiteFailure) => void>();
const recent = new Map<FailureCode, number>();
const pending: SiteFailure[] = [];
/** Notification only: callers retain their operation's commit/rollback rules. */
export function reportSiteFailure(code: FailureCode) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - (recent.get(code) ?? -Infinity) < 8000) return;
  recent.set(code, now);
  const failure = { code, message: failureMessages[code] };
  devLogger.error('SiteFailure', 'operation_failed', { code });
  devLogger.debug('SiteFailure', 'failure_context', { code, online: navigator.onLine });
  if (listeners.size) listeners.forEach(listener => listener(failure));
  else { pending.push(failure); if (pending.length > 3) pending.shift(); }
}
export function subscribeSiteFailures(listener: (failure: SiteFailure) => void) {
  listeners.add(listener);
  pending.splice(0).forEach(listener);
  return () => { listeners.delete(listener); };
}
