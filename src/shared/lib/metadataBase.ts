const FALLBACK_METADATA_BASE = 'https://undone.in';

/** Optional public metadata configuration must not prevent the application from rendering. */
export function resolveMetadataBase(value: string | undefined): URL {
  try {
    const candidate = new URL(value || FALLBACK_METADATA_BASE);
    if (['https:', 'http:'].includes(candidate.protocol) && !candidate.username && !candidate.password) return candidate;
  } catch { /* Invalid optional configuration uses the existing application fallback. */ }
  return new URL(FALLBACK_METADATA_BASE);
}
