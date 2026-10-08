import { z } from 'zod';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';

const envelopeSchema = z.strictObject({ expiresAt: z.number().finite(), snapshot: creationSnapshotSchema });
const storageKey = (id: string) => `undone:creation-session:v1:${id}`;
export function saveSessionDraft(snapshot: CreationSnapshot, storage: Pick<Storage, 'setItem'>, now = Date.now()): boolean {
  try {
    const validated = creationSnapshotSchema.parse(snapshot);
    storage.setItem(storageKey(snapshot.draftId), JSON.stringify({ expiresAt: now + 86_400_000, snapshot: validated }));
    return true;
  } catch { return false; }
}
export function loadSessionDraft(id: string, storage: Pick<Storage, 'getItem'>, now = Date.now()): CreationSnapshot | null {
  try {
    const raw = storage.getItem(storageKey(id));
    if (!raw || raw.length > 150_000) return null;
    const parsed = envelopeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.expiresAt <= now || parsed.data.snapshot.draftId !== id) return null;
    const snapshot = parsed.data.snapshot;
    // No durable job exists in 3A: an interrupted HTTP operation needs explicit retry.
    return snapshot.status === 'running'
      ? creationSnapshotSchema.parse({ ...snapshot, status: 'canceled', activeRequestId: null })
      : snapshot;
  } catch { return null; }
}
