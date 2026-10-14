/** No supported transcript provider is installed. An environment flag alone
 * must not advertise a capability whose acquisition gate has not passed. */
export function youtubeTranscriptReadiness() {
  return {enabled:false as const,code:'TRANSCRIPT_PROVIDER_REQUIRED' as const};
}
