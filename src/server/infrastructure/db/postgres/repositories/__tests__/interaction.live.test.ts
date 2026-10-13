import { describe, expect, it } from 'vitest';

/**
 * Opt-in live-DB smoke (INTERACTION_IT=1). Read-only unless INTERACTION_IT_OWNER_ID names an
 * existing user, in which case it runs a real createÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢commitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢replayÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢cleanup cycle.
 */
const live = process.env.INTERACTION_IT === '1';
const ownerId = process.env.INTERACTION_IT_OWNER_ID;

describe.skipIf(!live)('interaction tables (live DB)', { timeout: 60_000 }, () => {
  it('all four tables exist and are queryable', async () => {
    const { PrismaClient } = await import('@/generated/prisma/client');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, connectionTimeoutMillis: 30_000 }) });
    try {
      // Sequential: parallel cold connects to the Neon pooler can ETIMEDOUT.
      const counts = [await prisma.interactionWorkspace.count(), await prisma.interactionRequest.count(), await prisma.interactionEvent.count(), await prisma.interactionOutbox.count()];
      counts.forEach(c => expect(c).toBeGreaterThanOrEqual(0));
    } catch (e) { const x = e as { code?: string; meta?: unknown; cause?: unknown }; console.log('PRISMA_ERR', x.code, JSON.stringify(x.meta), String(x.cause)); throw e; } finally { await prisma.$disconnect(); }
  });

  it.skipIf(!ownerId)('real CAS commit, idempotent replay, stale rejection, cleanup', async () => {
    const { PrismaClient } = await import('@/generated/prisma/client');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { createPostgresInteractionRepository } = await import('../interaction.repo');
    const { planCohortAction } = await import('@/src/shared/cohort-builder/contracts');
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, connectionTimeoutMillis: 30_000 }) });
    const repo = createPostgresInteractionRepository(prisma as never);
    const id = crypto.randomUUID();
    const snap = { schemaVersion: 1, title: 't', intent: 'i', audience: 'a', dailyMinutes: 10, lessons: [] };
    try {
      await repo.createWorkspace({ id, ownerId: ownerId!, domainId: 'cohort', domainVersion: 1, initialSnapshot: snap });
      const env = { actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [], action: { type: 'set_intent', intent: 'live' } };
      const a = await repo.commitAction({ workspaceId: id, ownerId: ownerId!, expectedRevision: 0, envelope: env, plan: planCohortAction as never, requestId: 'k' });
      const b = await repo.commitAction({ workspaceId: id, ownerId: ownerId!, expectedRevision: 0, envelope: env, plan: planCohortAction as never, requestId: 'k' });
      expect(b.receipt.receiptId).toBe(a.receipt.receiptId);
      await expect(repo.commitAction({ workspaceId: id, ownerId: ownerId!, expectedRevision: 0, envelope: { ...env, actionId: crypto.randomUUID() }, plan: planCohortAction as never })).rejects.toThrow('STALE_WORKSPACE');
      expect((await repo.queryEvents({ workspaceId: id, ownerId: ownerId! })).length).toBe(1);
    } finally {
      await prisma.interactionWorkspace.deleteMany({ where: { id } }); // cascades
      await prisma.$disconnect();
    }
  });
});
