/**
 * Formats seconds into MM:SS.
 * Minutes are rendered with at least 2 digits and can exceed 59 (e.g. 120:00).
 */
export function formatClock(totalSeconds: number): string {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }
  const cleanSeconds = Math.floor(totalSeconds);
  const mins = Math.floor(cleanSeconds / 60);
  const secs = cleanSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats elapsed duration (in milliseconds) since participant joined.
 *
 * Rules per Section 4.8:
 * - < 60 s, NaN, or negative -> "Just joined"
 * - < 60 min -> "{m}m"
 * - >= 60 min -> "{h}h {m}m" (omits m when 0, e.g. "2h")
 */
export function formatElapsed(ms: number): string {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 60_000) {
    return 'Just joined';
  }

  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}
