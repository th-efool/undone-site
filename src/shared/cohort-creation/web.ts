import { z } from 'zod';
import { retainedObjectRefSchema } from './materials';

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
