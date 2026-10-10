import 'server-only';
import { prisma as defaultPrisma } from '../client';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { writeDraftEvent } from './creationEvent.repo';
import { releaseDetachedMaterialRefs } from './creationMaterialRefs';

export interface DraftRepository {
  create(ownerId: string, id: string): Promise<CreationSnapshot | null>;
  load(ownerId: string, id: string): Promise<CreationSnapshot | null>;
  swap(ownerId: string, id: string, baseRevision: number, next: CreationSnapshot): Promise<boolean>;
}
export function createCreationDraftRepository(prisma = defaultPrisma): DraftRepository { return {
  async create(ownerId, id) {
    // Retrying the same UUID is idempotent; it can never reassign ownership.
    await prisma.creationDraft.createMany({ data: [{ id, ownerId, snapshot: initialSnapshot(id) }], skipDuplicates: true });
    return this.load(ownerId, id);
  },
  async load(ownerId, id) {
    const row = await prisma.creationDraft.findFirst({ where: { id, ownerId, expiredAt: null } });
    if (!row) return null;
    const state = creationSnapshotSchema.parse(row.snapshot);
    if (state.draftId !== id || state.revision !== row.revision || state.schemaVersion !== row.schemaVersion) throw new Error('Invalid stored draft');
    return state;
  },
  async swap(ownerId, id, baseRevision, next) {
    const snapshot = creationSnapshotSchema.parse(next);
    if (snapshot.draftId !== id || snapshot.revision !== baseRevision + 1) throw new Error('Invalid revision transition');
    return prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ revision: number; snapshot: unknown }[]>`SELECT "revision", "snapshot" FROM "creation_drafts"
        WHERE "id"=${id} AND "ownerId"=${ownerId} AND "expiredAt" IS NULL FOR UPDATE`;
      if (rows[0]?.revision !== baseRevision) return false;
      const previous = creationSnapshotSchema.parse(rows[0].snapshot);
      if (previous.draftId !== id || previous.revision !== baseRevision) throw new Error('Invalid stored draft');
      await releaseDetachedMaterialRefs(tx, ownerId, previous, snapshot);
      await writeDraftEvent(tx, ownerId, snapshot, 'snapshot');
      return true;
    });
  },
}; }
export const creationDraftRepo = createCreationDraftRepository();
