import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sourceLocationSchema } from '@/src/shared/cohort-creation/contracts';
import { retainedObjectRefSchema } from '@/src/shared/cohort-creation/materials';
import { youtubeMetadataSchema, youtubeVideoMetadataSchema } from '@/src/shared/cohort-creation/youtube';
import { observationModelIdentitySchema, videoObservationCoverage, videoObservationProposalSchema, validateVideoObservation } from '../material-observation';

export const YOUTUBE_METADATA_VERSION = 'youtube-data-public-v1';
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
export const youtubeMetadataFingerprint = (materialId: string, inputRevision: number, url: string) =>
  createHash('sha256').update(JSON.stringify({ materialId, inputRevision, url, parser: YOUTUBE_METADATA_VERSION })).digest('hex');
export const youtubeMetadataReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), materialId: z.uuid(),
  inputRevision: z.number().int().nonnegative(), parserVersion: z.literal(YOUTUBE_METADATA_VERSION), metadata: youtubeMetadataSchema });
export const youtubeObservationArtifactSchema = z.strictObject({
  schemaVersion: z.literal(1), materialId: z.uuid(), unitId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  inputRevision: z.number().int().nonnegative(), version: checksum, metadataFingerprint: checksum,
  metadataArtifact: retainedObjectRefSchema.extend({ kind: z.literal('artifact') }), video: youtubeVideoMetadataSchema,
  model: observationModelIdentitySchema, extractionKind: z.literal('video_observation'), contentOrigin: z.literal('ai'),
  proposal: videoObservationProposalSchema,
  segments: z.array(z.strictObject({ id: checksum, text: z.string().min(1).max(10_000), location: sourceLocationSchema })).min(1).max(200),
  coverage: z.strictObject({ kind: z.literal('model_observation'), exhaustive: z.literal(false), timestampsEstimated: z.literal(true),
    unobservedRanges: z.array(z.strictObject({ startSeconds: z.number().nonnegative(), endSeconds: z.number().positive() })).max(201),
    limitations: z.array(z.string().min(1).max(1000)).max(20) }),
  observedAt: z.iso.datetime(),
}).superRefine((artifact, ctx) => {
  try {
    validateVideoObservation(artifact.proposal, artifact.video);
    if (artifact.video.videoId !== artifact.unitId || artifact.segments.length !== artifact.proposal.observations.length ||
      JSON.stringify(artifact.coverage) !== JSON.stringify(videoObservationCoverage(artifact.proposal, artifact.video)) ||
      artifact.version !== youtubeObservationVersion(artifact)) throw new Error('identity');
    for (const [index, segment] of artifact.segments.entries()) {
      const observation = artifact.proposal.observations[index]; const location = segment.location;
      if (segment.id !== youtubeObservationSegmentId(artifact.version, index) || segment.text !== observation.text ||
        location.materialId !== artifact.materialId || location.unitId !== artifact.unitId || location.segmentId !== segment.id ||
        location.anchor.kind !== 'video' || location.anchor.estimated !== true || location.anchor.startSeconds !== observation.startSeconds ||
        location.anchor.endSeconds !== observation.endSeconds) throw new Error('segment');
    }
  } catch { ctx.addIssue({ code: 'custom', message: 'Invalid retained video observation provenance or coverage' }); }
});
type ObservationIdentity = { materialId: string; unitId: string; inputRevision: number; metadataFingerprint: string;
  metadataArtifact: z.infer<typeof retainedObjectRefSchema>; video: z.infer<typeof youtubeVideoMetadataSchema>;
  model: z.infer<typeof observationModelIdentitySchema>; proposal: z.infer<typeof videoObservationProposalSchema> };
export const youtubeObservationVersion = (value: ObservationIdentity) => createHash('sha256').update(JSON.stringify({
  materialId: value.materialId, unitId: value.unitId, inputRevision: value.inputRevision, metadataFingerprint: value.metadataFingerprint,
  metadataChecksum: value.metadataArtifact.checksum, video: value.video, model: value.model, proposal: value.proposal,
})).digest('hex');
export const youtubeObservationSegmentId = (version: string, index: number) => createHash('sha256').update(`${version}:${index}`).digest('hex');
export type YoutubeObservationArtifact = z.infer<typeof youtubeObservationArtifactSchema>;
