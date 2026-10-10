import { z } from 'zod';
import { MATERIAL_LIMITS, retainedObjectRefSchema, materialManifestSchema } from './materials';
import { creationArtifactRefSchema, youtubeUnitObservationRefSchema } from './contracts';

export const youtubeVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
export const youtubePlaylistIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,128}$/);
export const youtubeVideoMetadataSchema = z.strictObject({
  videoId: youtubeVideoIdSchema, url: z.url().max(2048), title: z.string().min(1).max(1000),
  description: z.string().max(10_000), channelId: z.string().min(1).max(128), channelTitle: z.string().min(1).max(1000),
  durationSeconds: z.number().int().positive(), etag: z.string().min(1).max(256), privacy: z.literal('public'),
  publishedAt: z.iso.datetime(),
}).refine(video => video.url === `https://www.youtube.com/watch?v=${video.videoId}`, 'Canonical video URL required');
export const youtubeMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1), sourceUrl: z.url().max(2048), fetchedAt: z.iso.datetime(),
  kind: z.enum(['youtube_video', 'youtube_playlist']), playlistId: youtubePlaylistIdSchema.nullable(),
  units: z.array(youtubeVideoMetadataSchema).min(1).max(MATERIAL_LIMITS.selectedUnits),
  coverage: z.literal('complete_metadata'),
}).superRefine((metadata, ctx) => {
  const valid = metadata.kind === 'youtube_video'
    ? metadata.playlistId === null && metadata.units.length === 1 && metadata.sourceUrl === metadata.units[0].url
    : metadata.playlistId !== null && metadata.sourceUrl === `https://www.youtube.com/playlist?list=${metadata.playlistId}`;
  if (!valid || new Set(metadata.units.map(unit => unit.videoId)).size !== metadata.units.length) {
    ctx.addIssue({ code: 'custom', message: 'Invalid YouTube metadata identity or duplicate units' });
  }
});
export type YoutubeVideoMetadata = z.infer<typeof youtubeVideoMetadataSchema>;
export type YoutubeMetadata = z.infer<typeof youtubeMetadataSchema>;
export const YOUTUBE_METADATA_VERSION = 'youtube-data-public-v1';
export const youtubeMetadataReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), materialId: z.uuid(),
  inputRevision: z.number().int().nonnegative(), parserVersion: z.literal(YOUTUBE_METADATA_VERSION), metadata: youtubeMetadataSchema });
export const retainedYoutubeMetadataSchema = z.strictObject({ receipt: youtubeMetadataReceiptSchema,
  artifact: retainedObjectRefSchema.extend({ kind: z.literal('artifact') }), inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/) });
export type RetainedYoutubeMetadata = z.infer<typeof retainedYoutubeMetadataSchema>;
export const youtubeObservationCheckpointSchema = z.strictObject({ phase: z.literal('youtube_observations'),
  materialId: z.uuid(), inputRevision: z.number().int().nonnegative(), sourceRevision: z.number().int().nonnegative(),
  metadataArtifact: creationArtifactRefSchema, metadataFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  units: z.array(youtubeUnitObservationRefSchema).max(MATERIAL_LIMITS.selectedUnits),
}).superRefine((value, ctx) => {
  if (value.sourceRevision > value.inputRevision || new Set(value.units.map(unit => unit.unitId)).size !== value.units.length ||
    value.units.reduce((sum, unit) => sum + unit.textBytes, 0) > MATERIAL_LIMITS.extractedTextBytes) ctx.addIssue({ code: 'custom', message: 'Invalid observation checkpoint scope' });
});
export type YoutubeObservationCheckpoint = z.infer<typeof youtubeObservationCheckpointSchema>;
export const youtubeMaterialManifestSchema = materialManifestSchema.safeExtend({ youtube: youtubeObservationCheckpointSchema })
  .superRefine((manifest, ctx) => {
    const units = manifest.youtube.units;
    if (!['youtube_video', 'youtube_playlist'].includes(manifest.source.kind) || manifest.source.input.kind !== 'url' ||
      manifest.source.id !== manifest.youtube.materialId || manifest.inputRevision !== manifest.youtube.inputRevision ||
      manifest.retainedSource.kind !== 'artifact' || manifest.retainedSource.id !== manifest.youtube.metadataArtifact.id ||
      manifest.retainedSource.checksum !== manifest.youtube.metadataArtifact.checksum || !units.length ||
      JSON.stringify(manifest.source.selectedUnitIds) !== JSON.stringify(units.map(unit => unit.unitId)) ||
      manifest.extraction.extractionKind !== 'video_observation' || manifest.extraction.complete !== false ||
      manifest.extraction.selectionScope !== 'video_observation' || manifest.extraction.segmentCount !== units.reduce((sum, unit) => sum + unit.segmentCount, 0)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid video observation manifest scope or provenance' });
    }
  });
export type YoutubeMaterialManifest = z.infer<typeof youtubeMaterialManifestSchema>;
