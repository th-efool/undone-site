import 'server-only';

/** Verified readiness gate for YouTube native-video observation.
 * Native-video readiness uses the compatible model/metadata requirements. */
export function youtubeVideoReadiness(): { enabled: boolean; code: string | null } {
  const enabled = process.env.INTERACTION_YOUTUBE_ENABLED === '1' || process.env.INTERACTION_YOUTUBE_VIDEO_ENABLED === '1';
  if (!enabled && process.env.INTERACTION_YOUTUBE_FIXTURE !== '1') {
    return { enabled: false, code: 'YOUTUBE_CAPABILITY_DISABLED' };
  }
  if (process.env.INTERACTION_YOUTUBE_FIXTURE === '1' && process.env.NODE_ENV === 'development') {
    return { enabled: true, code: null };
  }
  const hasApiKey = Boolean(process.env.YOUTUBE_API_KEY?.trim());
  if (!hasApiKey && process.env.INTERACTION_YOUTUBE_FIXTURE !== '1') {
    return { enabled: false, code: 'YOUTUBE_METADATA_UNAVAILABLE' };
  }
  const hasModel = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (!hasModel && process.env.INTERACTION_YOUTUBE_FIXTURE !== '1') {
    return { enabled: false, code: 'YOUTUBE_MODEL_UNAVAILABLE' };
  }
  return { enabled: true, code: null };
}
