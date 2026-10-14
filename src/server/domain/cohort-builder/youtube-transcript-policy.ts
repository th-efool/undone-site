import { validateTranscriptEndpoint } from './youtube-transcript-live';

/** Verified readiness gate for YouTube transcript ingestion.
 * Advertising the capability requires both the feature flag AND a valid,
 * approved provider endpoint configuration. */
export function youtubeTranscriptReadiness() {
  const enabled = process.env.INTERACTION_YOUTUBE_ENABLED === '1';
  if (!enabled) {
    return { enabled: false as const, code: 'YOUTUBE_CAPABILITY_DISABLED' as const };
  }
  const endpoint = process.env.INTERACTION_YOUTUBE_TRANSCRIPT_ENDPOINT;
  if (!endpoint) {
    return { enabled: false as const, code: 'TRANSCRIPT_PROVIDER_REQUIRED' as const };
  }
  try {
    validateTranscriptEndpoint(endpoint);
    return { enabled: true as const, code: null };
  } catch {
    return { enabled: false as const, code: 'TRANSCRIPT_PROVIDER_INVALID' as const };
  }
}
