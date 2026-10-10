import { z } from 'zod';
import { materialManifestSchema, retainedObjectRefSchema, textExtractionArtifactSchema } from './materials';

const httpsUrl = z.url().max(2048).refine(value => {
  const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash;
}, 'Expected normalized HTTPS provenance');
/** A retained response receipt is not an extracted-content manifest or a ready source. */
export const webResponseReceiptSchema = z.strictObject({
  schemaVersion: z.literal(1), materialId: z.string().min(1).max(128), inputRevision: z.number().int().nonnegative(),
  requestedUrl: httpsUrl, finalUrl: httpsUrl, redirects: z.array(httpsUrl).max(3),
  mediaType: z.enum(['text/html', 'text/plain', 'text/markdown', 'text/x-markdown']),
  retainedSource: retainedObjectRefSchema.extend({ kind: z.literal('upload') }),
  fetchedAt: z.iso.datetime(), fetchVersion: z.literal('public-https-pinned-v1'),
}).refine(value => (value.redirects.at(-1) ?? value.requestedUrl) === value.finalUrl, 'Inconsistent redirect provenance');
export type WebResponseReceipt = z.infer<typeof webResponseReceiptSchema>;

export const webExtractionArtifactSchema = textExtractionArtifactSchema.safeExtend({
  contentOrigin: z.literal('external'),
  web: z.strictObject({ receipt: webResponseReceiptSchema,
    scope: z.enum(['main_article', 'full_text_response']),
    parserVersion: z.string().min(1).max(128), title: z.string().max(1000).nullable(),
    format: z.enum(['normalized_article_text', 'exact_response_text']),
  }),
}).superRefine((value, ctx) => {
  const receipt = value.web.receipt;
  if (value.materialId !== receipt.materialId || value.sourceRef.id !== receipt.retainedSource.id ||
    value.sourceChecksum !== receipt.retainedSource.checksum || value.sourceRef.byteLength !== receipt.retainedSource.byteLength ||
    (receipt.mediaType === 'text/html' ? value.web.scope !== 'main_article' || value.web.format !== 'normalized_article_text'
      : value.web.scope !== 'full_text_response' || value.web.format !== 'exact_response_text')) {
    ctx.addIssue({ code: 'custom', message: 'Invalid web extraction provenance or scope' });
  }
});
export type WebExtractionArtifact = z.infer<typeof webExtractionArtifactSchema>;
export const webMaterialManifestSchema = materialManifestSchema.safeExtend({
  receipt: webResponseReceiptSchema, receiptArtifact: retainedObjectRefSchema.extend({ kind: z.literal('artifact') }),
  receiptFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).superRefine((value, ctx) => {
  if (value.source.kind !== 'web' || value.source.input.kind !== 'url' || value.source.input.url !== value.receipt.requestedUrl ||
    value.source.id !== value.receipt.materialId || value.inputRevision !== value.receipt.inputRevision ||
    value.retainedSource.id !== value.receipt.retainedSource.id || value.retainedSource.checksum !== value.receipt.retainedSource.checksum) {
    ctx.addIssue({ code: 'custom', message: 'Invalid web manifest identity' });
  }
});
export type WebMaterialManifest = z.infer<typeof webMaterialManifestSchema>;
