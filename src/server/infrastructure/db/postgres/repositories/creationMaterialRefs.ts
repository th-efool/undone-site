import type { Prisma } from '@/generated/prisma/client';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';

function refs(state: CreationSnapshot) {
  return [...state.materials.flatMap(source => source.input.kind === 'upload' ? [source.input.assetId] : []),
    ...state.extractions.map(extraction => extraction.artifactRef), ...state.materialRefs.flatMap(ref => ref.ids)];
}
/** Caller holds the owner draft lock; detach only references absent from the next snapshot. */
export async function releaseDetachedMaterialRefs(tx: Prisma.TransactionClient, ownerId: string,
  previous: CreationSnapshot, next: CreationSnapshot) {
  const retained = new Set(refs(next));
  const detached = [...new Set(refs(previous))].filter(id => !retained.has(id));
  if (detached.length) await tx.creationStorageObject.updateMany({ where: {
    id: { in: detached }, ownerId, draftId: next.draftId, publishedAt: null,
  }, data: { referencedAt: null } });
}
