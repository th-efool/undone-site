import { z } from 'zod';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { youtubeVideoMetadataSchema, type YoutubeVideoMetadata } from '@/src/shared/cohort-creation/youtube';
import { creationFailure } from './errors';

export const videoObservationProposalSchema = z.strictObject({
  canObserve: z.boolean(),
  observations: z.array(z.strictObject({ startSeconds: z.number().nonnegative(), endSeconds: z.number().positive(),
    text: z.string().trim().min(1).max(10_000) })).max(200),
  limitations: z.array(z.string().trim().min(1).max(1000)).max(20),
});
export type VideoObservationProposal = z.infer<typeof videoObservationProposalSchema>;
export interface MaterialObservation {
  observeVideo(video: YoutubeVideoMetadata, signal: AbortSignal): Promise<VideoObservationProposal>;
}

export function validateVideoObservation(input: unknown, metadata: YoutubeVideoMetadata) {
  const video = youtubeVideoMetadataSchema.parse(metadata);
  const parsed = videoObservationProposalSchema.safeParse(input);
  if (!parsed.success) throw creationFailure('AI_INVALID_OUTPUT', 'Video observations could not be validated.');
  const proposal = parsed.data;
  if (!proposal.canObserve) {
    if (proposal.observations.length) throw creationFailure('AI_INVALID_OUTPUT', 'Inaccessible video returned inconsistent observations.');
    throw creationFailure('DATA_UNAVAILABLE', 'The model could not observe this public video. Supply authorized transcript/text material or retry after checking provider support.', false);
  }
  if (!proposal.observations.length) throw creationFailure('AI_INVALID_OUTPUT', 'No usable video observations were returned.');
  let cursor = 0;
  for (const item of proposal.observations) {
    if (item.startSeconds < cursor || item.endSeconds <= item.startSeconds || item.endSeconds > video.durationSeconds) {
      throw creationFailure('AI_INVALID_OUTPUT', 'Video observations contain invalid, overlapping or out-of-duration ranges.');
    }
    cursor = item.endSeconds;
  }
  if (Buffer.byteLength(proposal.observations.map(item => item.text).join('\n\n'), 'utf8') > MATERIAL_LIMITS.extractedTextBytes) {
    throw creationFailure('AI_INVALID_OUTPUT', 'Video observations exceed 1 MiB. Narrow the source scope; nothing was truncated.', false);
  }
  return proposal;
}

/** Gaps come from validated estimated intervals, not an AI assertion of completeness. */
export function videoObservationCoverage(proposal: VideoObservationProposal, video: YoutubeVideoMetadata) {
  const valid = validateVideoObservation(proposal, video); let cursor = 0;
  const unobservedRanges: { startSeconds: number; endSeconds: number }[] = [];
  for (const item of valid.observations) {
    if (item.startSeconds > cursor) unobservedRanges.push({ startSeconds: cursor, endSeconds: item.startSeconds });
    cursor = item.endSeconds;
  }
  if (cursor < video.durationSeconds) unobservedRanges.push({ startSeconds: cursor, endSeconds: video.durationSeconds });
  return { kind: 'model_observation' as const, exhaustive: false as const, timestampsEstimated: true as const,
    unobservedRanges, limitations: valid.limitations };
}
