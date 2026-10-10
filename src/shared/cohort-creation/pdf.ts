import { z } from 'zod';
import { sourceLocationSchema } from './contracts';
import { textExtractionArtifactSchema } from './materials';

export const PDF_LIMITS = { bytes: 25 * 1024 * 1024, pages: 200, timeoutMs: 45_000 } as const;
/** PDF anchors identify physical pages; ranges address normalized extraction text only. */
export const pdfExtractionArtifactSchema = z.strictObject({
  ...textExtractionArtifactSchema.shape,
  segments: z.array(z.strictObject({ id: z.string().min(1).max(128), kind: z.enum(['text', 'heading', 'code']),
    text: z.string().min(1).max(4096), location: sourceLocationSchema,
    start: z.number().int().nonnegative(), end: z.number().int().positive(),
  })).min(1).max(20_000),
  pdf: z.strictObject({ parserVersion: z.string().min(1).max(128), format: z.literal('page_text_items'),
    pages: z.array(z.strictObject({ page: z.number().int().positive(), start: z.number().int().nonnegative(),
      end: z.number().int().positive() })).min(1).max(PDF_LIMITS.pages),
  }),
}).superRefine((artifact, ctx) => {
  let cursor = 0; const ids = new Set<string>(); let segmentIndex = 0;
  for (const [index, page] of artifact.pdf.pages.entries()) {
    if (page.page !== index + 1 || page.start !== cursor || page.end <= page.start ||
      !artifact.text.slice(page.start, page.end).trim()) {
      ctx.addIssue({ code: 'custom', message: 'Invalid PDF page coverage' }); return;
    }
    while (segmentIndex < artifact.segments.length && artifact.segments[segmentIndex].start < page.end) {
      const segment = artifact.segments[segmentIndex++];
      if (segment.start !== cursor || segment.end <= segment.start || segment.end > page.end ||
        segment.location.anchor.kind !== 'page' || segment.location.anchor.page !== page.page ||
        segment.location.materialId !== artifact.materialId || segment.location.unitId !== artifact.unitId ||
        segment.location.segmentId !== segment.id || ids.has(segment.id) ||
        artifact.text.slice(segment.start, segment.end) !== segment.text) {
        ctx.addIssue({ code: 'custom', message: 'Invalid PDF segment provenance' }); return;
      }
      ids.add(segment.id); cursor = segment.end;
    }
    if (cursor !== page.end) { ctx.addIssue({ code: 'custom', message: 'Incomplete PDF page' }); return; }
  }
  if (cursor !== artifact.text.length || segmentIndex !== artifact.segments.length ||
    new TextEncoder().encode(artifact.text).byteLength !== artifact.utf8ByteLength ||
    artifact.sourceRef.kind !== 'upload' || artifact.sourceChecksum !== artifact.sourceRef.checksum) {
    ctx.addIssue({ code: 'custom', message: 'Incomplete or inconsistent PDF extraction' });
  }
});
export type PdfExtractionArtifact = z.infer<typeof pdfExtractionArtifactSchema>;
