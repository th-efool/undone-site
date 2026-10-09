import 'server-only';
import { prisma as defaultPrisma } from '../client';
import type { CreationRetentionRepository } from '@/src/server/domain/cohort-creation/retention';

export function createCreationRetentionRepository(prisma = defaultPrisma): CreationRetentionRepository {
  return {
    async expireInactive(now, limit) {
      return prisma.$transaction(async tx => {
        // Same draft-first lock order as mutations, uploads and job claims.
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT d."id" FROM "creation_drafts" d
          WHERE d."expiredAt" IS NULL AND d."updatedAt" <= ${new Date(now.getTime() - 60 * 86400_000)}
          AND NOT EXISTS (SELECT 1 FROM "creation_jobs" j WHERE j."draftId"=d."id" AND j."status" IN ('queued','running'))
          AND NOT EXISTS (SELECT 1 FROM "creation_storage_objects" o WHERE o."draftId"=d."id" AND
            (o."publishedAt" IS NOT NULL OR o."readLeaseUntil">${now} OR
             (o."status"='uploading' AND o."createdAt">${new Date(now.getTime() - 86400_000)})))
          ORDER BY d."updatedAt",d."id" LIMIT ${limit} FOR UPDATE OF d SKIP LOCKED`;
        for (const row of rows) {
          await tx.creationDraft.update({ where: { id: row.id }, data: { expiredAt: now } });
          await tx.creationStorageObject.updateMany({ where: { draftId: row.id, publishedAt: null },
            data: { referencedAt: null } });
        }
        return rows.length;
      });
    },
    async finalizeExpired(limit) {
      // Restrict FK also prevents deletion if a private object has not been reclaimed.
      return prisma.$executeRaw`DELETE FROM "creation_drafts" WHERE "id" IN
        (SELECT d."id" FROM "creation_drafts" d WHERE d."expiredAt" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "creation_storage_objects" o WHERE o."draftId"=d."id")
         AND NOT EXISTS (SELECT 1 FROM "creation_jobs" j WHERE j."draftId"=d."id" AND j."status" IN ('queued','running'))
         ORDER BY d."expiredAt",d."id" LIMIT ${limit} FOR UPDATE OF d SKIP LOCKED)`;
    },
    async prune(now, limit) {
      const events = await prisma.$executeRaw`DELETE FROM "creation_events" WHERE "id" IN
        (SELECT "id" FROM "creation_events" WHERE "createdAt" < ${new Date(now.getTime() - 7 * 86400_000)}
         ORDER BY "createdAt","id" LIMIT ${limit})`;
      // Never reset model-slot generations: delayed releases must remain fenced.
      const budgets = await prisma.$executeRaw`DELETE FROM "creation_budgets" WHERE "key" IN
        (SELECT "key" FROM "creation_budgets" WHERE "expiresAt" <= ${now}
         AND "key" NOT IN ('active-model-slot:0','active-model-slot:1')
         ORDER BY "expiresAt","key" LIMIT ${limit})`;
      return { events, budgets };
    },
  };
}
export const creationRetentionRepo = createCreationRetentionRepository();
