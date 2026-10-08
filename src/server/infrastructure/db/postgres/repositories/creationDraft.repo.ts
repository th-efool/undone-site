import 'server-only';
import { prisma } from '../client';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';

export interface DraftRepository {
  create(ownerId: string, id: string): Promise<CreationSnapshot | null>;
  load(ownerId: string, id: string): Promise<CreationSnapshot | null>;
  swap(ownerId: string, id: string, baseRevision: number, next: CreationSnapshot): Promise<boolean>;
}
export const creationDraftRepo: DraftRepository = {
  async create(ownerId, id) {
    // Retrying the same UUID is idempotent; it can never reassign ownership.
    await prisma.creationDraft.createMany({ data: [{ id, ownerId, snapshot: initialSnapshot(id) }], skipDuplicates: true });
    return this.load(ownerId, id);
  },
  async load(ownerId, id) {
    const row = await prisma.creationDraft.findFirst({ where: { id, ownerId } });
    if (!row) return null;
    const state = creationSnapshotSchema.parse(row.snapshot);
    if (state.draftId !== id || state.revision !== row.revision || state.schemaVersion !== row.schemaVersion) throw new Error('Invalid stored draft');
    return state;
  },
  async swap(ownerId, id, baseRevision, next) {
    const snapshot = creationSnapshotSchema.parse(next);
    if (snapshot.draftId !== id || snapshot.revision !== baseRevision + 1) throw new Error('Invalid revision transition');
    const result = await prisma.creationDraft.updateMany({
      where: { id, ownerId, revision: baseRevision },
      data: { snapshot, revision: { increment: 1 } },
    });
    return result.count === 1;
  },
};
