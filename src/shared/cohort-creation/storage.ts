import { z } from 'zod';
/** Owner/draft scope is enforced by repositories; this is the serializable reference only. */
export const retainedObjectRefSchema = z.strictObject({
  id: z.uuid(), kind: z.enum(['upload', 'artifact']), byteLength: z.number().int().positive().max(25 * 1024 * 1024),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
