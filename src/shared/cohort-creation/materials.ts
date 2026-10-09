import { z } from 'zod';
import { extractedContentSchema, materialSourceSchema, sourceLocationSchema } from './contracts';

export const MATERIAL_LIMITS = { sources: 20, selectedUnits: 100, extractedTextBytes: 1024 * 1024 } as const;
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
export const retainedObjectRefSchema = z.strictObject({
  id: z.uuid(), kind: z.enum(['upload', 'artifact']), byteLength: z.number().int().positive().max(25 * 1024 * 1024), checksum,
});
export const materialSelectionSchema = z.array(materialSourceSchema).max(MATERIAL_LIMITS.sources)
  .superRefine((sources, ctx) => {
    if (new Set(sources.map(source => source.id)).size !== sources.length) ctx.addIssue({ code: 'custom', message: 'Duplicate material IDs' });
    if (sources.reduce((sum, source) => sum + source.selectedUnitIds.length, 0) > MATERIAL_LIMITS.selectedUnits) {
      ctx.addIssue({ code: 'custom', message: 'Selected unit limit exceeded' });
    }
    if (sources.some(source => new Set(source.selectedUnitIds).size !== source.selectedUnitIds.length)) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate selected units' });
    }
  });

export const textExtractionArtifactSchema = z.strictObject({
  schemaVersion: z.literal(1), materialId: z.string().min(1).max(128), unitId: z.string().min(1).max(128),
  version: checksum, sourceChecksum: checksum, sourceRef: retainedObjectRefSchema,
  extractionKind: z.literal('text'), contentOrigin: z.literal('user'), offsetUnit: z.literal('utf16'),
  text: z.string().min(1).max(MATERIAL_LIMITS.extractedTextBytes),
  utf8ByteLength: z.number().int().positive().max(MATERIAL_LIMITS.extractedTextBytes),
  segments: z.array(z.strictObject({ id: z.string().min(1).max(128),
    kind: z.enum(['text', 'heading', 'code']), text: z.string().min(1).max(4096), location: sourceLocationSchema,
  })).min(1).max(20_000),
  coverage: z.strictObject({ complete: z.literal(true), omittedRanges: z.array(z.never()).length(0) }),
}).superRefine((artifact, ctx) => {
  let cursor = 0;
  const ids = new Set<string>();
  for (const segment of artifact.segments) {
    const { anchor } = segment.location;
    if (anchor.kind !== 'text' || anchor.start !== cursor ||
      artifact.text.slice(anchor.start, anchor.end) !== segment.text ||
      segment.location.materialId !== artifact.materialId || segment.location.unitId !== artifact.unitId ||
      segment.location.segmentId !== segment.id || ids.has(segment.id)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid segment provenance or coverage' });
      return;
    }
    ids.add(segment.id); cursor = anchor.end;
  }
  if (cursor !== artifact.text.length || artifact.segments.map(segment => segment.text).join('') !== artifact.text ||
    new TextEncoder().encode(artifact.text).byteLength !== artifact.utf8ByteLength ||
    artifact.sourceChecksum !== artifact.sourceRef.checksum || artifact.sourceRef.kind !== 'upload') {
    ctx.addIssue({ code: 'custom', message: 'Incomplete or inconsistent text extraction' });
  }
});
export type TextExtractionArtifact = z.infer<typeof textExtractionArtifactSchema>;

export const materialManifestSchema = z.strictObject({
  schemaVersion: z.literal(1), inputRevision: z.number().int().nonnegative(),
  source: materialSourceSchema, retainedSource: retainedObjectRefSchema,
  extraction: extractedContentSchema.extend({ version: checksum, checksum, artifactRef: z.uuid() }),
  extractionArtifact: retainedObjectRefSchema, parserVersion: z.string().min(1).max(128),
  inputFingerprint: checksum, acquiredAt: z.iso.datetime(),
}).superRefine((manifest, ctx) => {
  if (manifest.source.status !== 'ready' || manifest.source.id !== manifest.extraction.materialId ||
    manifest.retainedSource.checksum !== manifest.extraction.checksum ||
    manifest.extractionArtifact.id !== manifest.extraction.artifactRef || manifest.extractionArtifact.kind !== 'artifact') {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent material manifest' });
  }
});
export type MaterialManifest = z.infer<typeof materialManifestSchema>;
