import { createHash } from 'node:crypto';
import { z } from 'zod';
import { extractedContentSchema, materialSourceSchema, sourceLocationSchema, type ExtractedContent, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { MATERIAL_LIMITS, textExtractionArtifactSchema } from '@/src/shared/cohort-creation/materials';
import { pdfExtractionArtifactSchema } from '@/src/shared/cohort-creation/pdf';
import { webExtractionArtifactSchema } from '@/src/shared/cohort-creation/web';
import { githubExtractionArtifactSchema } from '@/src/shared/cohort-creation/github';
import { notionExtractionArtifactSchema } from '@/src/shared/cohort-creation/notion';
import { youtubeObservationCheckpointSchema } from '@/src/shared/cohort-creation/youtube';
import { youtubeObservationArtifactSchema } from './materials/youtube-artifacts';
import { youtubeMaterialVersion } from './materials/youtube-identity';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';

const segmentSchema = z.strictObject({ id: z.string().min(1).max(128), text: z.string().min(1).max(10_000), location: sourceLocationSchema });
export type ProcessingSegment = z.infer<typeof segmentSchema>;
export type ProcessingUnit = { materialId: string; unitId: string; extractionVersion: string; artifactId: string;
  contentOrigin: 'user' | 'external' | 'ai'; coverage: { scope: string; exhaustive: boolean; limitations: string[] };
  segments: ProcessingSegment[] };
export type ProcessingPartition = ProcessingUnit & { id: string; index: number; textBytes: number };
export const PROCESSING_LIMITS = { partitionTextBytes: 24 * 1024, partitions: 1000, segments: 20_000 } as const;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function invalid(): never { throw new CreationStorageError('INTEGRITY', 'Retained content does not match the accepted source, extraction version or selection.'); }
function limit(): never { throw new CreationStorageError('LIMIT_EXCEEDED', 'Processing scope exceeds its text or partition limit. Select less material; nothing was truncated.'); }

/** Pure projection of already owner-checked artifact bodies; never authorizes a storage read. */
export function normalizeProcessingInput(input: MaterialSource, accepted: ExtractedContent, value: unknown,
  observations: unknown[] = [], signal?: AbortSignal): ProcessingUnit[] {
  signal?.throwIfAborted(); const source = materialSourceSchema.parse(input); const extraction = extractedContentSchema.parse(accepted);
  if (source.status !== 'ready' || source.id !== extraction.materialId || !source.selectedUnitIds.length ||
    new Set(source.selectedUnitIds).size !== source.selectedUnitIds.length ||
    (['markdown', 'pdf'].includes(source.kind) ? source.input.kind !== 'upload' : source.input.kind !== 'url')) invalid();
  let version: string; let checksum: string; let materialId: string; let units: ProcessingUnit[];
  const unit = (unitId: string, segments: ProcessingSegment[], origin: ProcessingUnit['contentOrigin'], scope: string,
    exhaustive = true, limitations: string[] = []): ProcessingUnit => ({ materialId: source.id, unitId, extractionVersion: extraction.version,
    artifactId: extraction.artifactRef, contentOrigin: origin, coverage: { scope, exhaustive, limitations },
    segments: segments.map(segment => segmentSchema.parse({ id: segment.id, text: segment.text, location: segment.location })) });
  if (source.kind === 'github') {
    const body = githubExtractionArtifactSchema.parse(value); ({ version, materialId } = body); checksum = body.sourceArtifact.checksum;
    if (extraction.selectionScope !== 'selected_paths') invalid();
    units = body.files.map(file => unit(file.unitId, file.segments, body.contentOrigin, 'selected_paths', true,
      body.coverage.skipped.map(item => `${item.path}: ${item.reason}`)));
  } else if (source.kind === 'notion') {
    const body = notionExtractionArtifactSchema.parse(value); ({ version, materialId } = body); checksum = body.sourceArtifact.checksum;
    if (extraction.selectionScope !== 'supported_page_text') invalid();
    units = [unit(body.unitId, body.blocks.flatMap(block => block.segments), body.contentOrigin, 'supported_page_text', true,
      body.blocks.filter(block => block.omission).map(block => `${block.id}: ${block.omission}`))];
  } else if (source.kind === 'youtube_video' || source.kind === 'youtube_playlist') {
    const body = youtubeObservationCheckpointSchema.parse(value); version = youtubeMaterialVersion(body); materialId = body.materialId; checksum = body.metadataArtifact.checksum;
    if (extraction.extractionKind !== 'video_observation' || extraction.complete || extraction.selectionScope !== 'video_observation' ||
      observations.length !== body.units.length) invalid();
    units = body.units.map((ref, index) => {
      signal?.throwIfAborted(); const observed = youtubeObservationArtifactSchema.parse(observations[index]);
      if (observed.materialId !== source.id || observed.unitId !== ref.unitId || observed.version !== ref.version ||
        observed.inputRevision !== body.sourceRevision || observed.metadataFingerprint !== body.metadataFingerprint ||
        JSON.stringify(observed.metadataArtifact) !== JSON.stringify(body.metadataArtifact) || observed.segments.length !== ref.segmentCount ||
        observed.segments.reduce((sum, segment) => sum + Buffer.byteLength(segment.text), 0) !== ref.textBytes) invalid();
      return { ...unit(ref.unitId, observed.segments, 'ai', 'video_observation', false,
        ['Model observations are not a transcript; timestamps are estimated.', ...observed.coverage.limitations,
          ...observed.coverage.unobservedRanges.map(range => `Unobserved estimated interval: ${range.startSeconds}–${range.endSeconds} seconds.`)]), artifactId: ref.artifact.id };
    });
  } else {
    const web = source.kind === 'web' ? webExtractionArtifactSchema.parse(value) : null;
    const body = web ?? (source.kind === 'pdf' ? pdfExtractionArtifactSchema.parse(value)
      : source.kind === 'markdown' ? textExtractionArtifactSchema.parse(value) : invalid());
    ({ version, materialId } = body); checksum = body.sourceChecksum;
    if (source.input.kind === 'upload' && source.input.assetId !== body.sourceRef.id) invalid();
    if (web && (source.input.kind !== 'url' || source.input.url !== web.web.receipt.requestedUrl || extraction.selectionScope !== web.web.scope)) invalid();
    units = [unit(body.unitId, body.segments, body.contentOrigin, web ? web.web.scope : 'full_text')];
  }
  if (source.id !== materialId || extraction.version !== version || extraction.checksum !== checksum ||
    (source.kind !== 'youtube_video' && source.kind !== 'youtube_playlist' && (extraction.extractionKind !== 'text' || !extraction.complete)) ||
    JSON.stringify(units.map(item => item.unitId)) !== JSON.stringify(source.selectedUnitIds) ||
    units.reduce((sum, item) => sum + item.segments.length, 0) !== extraction.segmentCount) invalid();
  validateUnits(units, signal); return units;
}

function validateUnits(units: ProcessingUnit[], signal?: AbortSignal) {
  if (!units.length || units.length > MATERIAL_LIMITS.selectedUnits) invalid();
  const ids = new Set<string>(); let bytes = 0; let count = 0; const sources = new Map<string, number>();
  for (const item of units) {
    signal?.throwIfAborted(); const id = `${item.materialId}:${item.unitId}`; if (ids.has(id) || !item.segments.length) invalid(); ids.add(id);
    const segments = new Set<string>();
    for (const segment of item.segments) {
      segmentSchema.parse(segment); if (segments.has(segment.id) || segment.id !== segment.location.segmentId ||
        item.materialId !== segment.location.materialId || item.unitId !== segment.location.unitId) invalid();
      segments.add(segment.id); const size = Buffer.byteLength(segment.text); bytes += size; count++;
      sources.set(item.materialId, (sources.get(item.materialId) ?? 0) + size);
    }
  }
  if (count > PROCESSING_LIMITS.segments || bytes > MATERIAL_LIMITS.sources * MATERIAL_LIMITS.extractedTextBytes ||
    [...sources.values()].some(size => size > MATERIAL_LIMITS.extractedTextBytes)) limit();
}

/** Exact segment coverage, bounded conservatively by UTF-8 bytes rather than guessed token counts. */
export function partitionProcessingInput(units: ProcessingUnit[], maxTextBytes: number = PROCESSING_LIMITS.partitionTextBytes,
  signal?: AbortSignal): ProcessingPartition[] {
  if (!Number.isSafeInteger(maxTextBytes) || maxTextBytes < 1 || maxTextBytes > PROCESSING_LIMITS.partitionTextBytes) limit();
  validateUnits(units, signal); const result: ProcessingPartition[] = [];
  for (const unit of units) {
    let segments: ProcessingSegment[] = []; let textBytes = 0; let index = 0;
    const append = () => {
      if (!segments.length) return;
      if (result.length >= PROCESSING_LIMITS.partitions) limit();
      result.push({ ...unit, segments, index, textBytes, id: hash({ version: 'processing-partition-v1', materialId: unit.materialId,
        unitId: unit.unitId, extractionVersion: unit.extractionVersion, artifactId: unit.artifactId,
        contentOrigin: unit.contentOrigin, coverage: unit.coverage, index, segments }) });
      segments = []; textBytes = 0; index++;
    };
    for (const segment of unit.segments) {
      signal?.throwIfAborted(); const bytes = Buffer.byteLength(segment.text); if (bytes > maxTextBytes) limit();
      if (textBytes + bytes > maxTextBytes) append();
      segments.push(segment); textBytes += bytes;
    }
    append();
  }
  return result;
}

export function validateProcessingPartition(partition: ProcessingPartition): ProcessingPartition {
  const parts = partitionProcessingInput([partition]);
  if (parts.length !== 1 || !Number.isSafeInteger(partition.index) || partition.index < 0 ||
    partition.textBytes !== parts[0].textBytes || partition.id !== hash({ version: 'processing-partition-v1', materialId: partition.materialId,
      unitId: partition.unitId, extractionVersion: partition.extractionVersion, artifactId: partition.artifactId,
      contentOrigin: partition.contentOrigin, coverage: partition.coverage, index: partition.index, segments: partition.segments })) invalid();
  return partition;
}
