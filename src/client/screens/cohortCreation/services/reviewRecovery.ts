import { z } from 'zod';

const metadataSchema = z.strictObject({ title: z.string().max(300), description: z.string().max(2000), visibility: z.enum(['PUBLIC', 'PRIVATE']),
  chatEnabled: z.boolean(), eventsEnabled: z.boolean() });
export const reviewRecoverySchema = z.strictObject({ schemaVersion: z.literal(1), draftId: z.uuid(),
  buildFingerprint: z.string().regex(/^[a-f0-9]{64}$/), editRevision: z.number().int().nonnegative(), savedAt: z.number().int().nonnegative(),
  metadata: metadataSchema.nullable(), lessonEdits: z.record(z.string().min(1).max(128), z.strictObject({ title: z.string().max(300), objectives: z.string().max(21000) })),
});
export type ReviewRecovery = z.infer<typeof reviewRecoverySchema>;
const key = (draftId: string) => `undone:unsaved-review:v1:${z.uuid().parse(draftId)}`;
const MAX_BYTES = 256 * 1024;
const MAX_AGE = 24 * 60 * 60_000;
export function readReviewRecovery(draftId: string, storage: Pick<Storage, 'getItem' | 'removeItem'>, now = Date.now()): ReviewRecovery | null {
  const id = key(draftId); const raw = storage.getItem(id); if (!raw) return null;
  try {
    if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error('Recovery exceeds limit');
    const value = reviewRecoverySchema.parse(JSON.parse(raw));
    if (value.draftId !== draftId || value.savedAt > now || now - value.savedAt >= MAX_AGE ||
      !value.metadata && !Object.keys(value.lessonEdits).length) throw new Error('Stale recovery');
    return value;
  } catch { storage.removeItem(id); return null; }
}
export function writeReviewRecovery(input: ReviewRecovery, storage: Pick<Storage, 'setItem'>) {
  const value = reviewRecoverySchema.parse(input); const raw = JSON.stringify(value);
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error('Unsaved review exceeds tab recovery limit');
  storage.setItem(key(value.draftId), raw);
}
export function removeReviewRecovery(draftId: string, storage: Pick<Storage, 'removeItem'>) { storage.removeItem(key(draftId)); }
