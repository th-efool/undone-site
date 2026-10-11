import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from './client';

export type ExecutionScope = { ownerId: string; draftId: string; requestId: string };

/** A lost start response can duplicate transport runs, but never bypass SQL job fencing. */
export function createCreationExecutionRepository(db = prisma) { return {
  async reserve(scope: ExecutionScope): Promise<{ jobId: string; token: string } | null> {
    const token = randomUUID();
    const rows = await db.$queryRaw<{ jobId: string; token: string }[]>`
      INSERT INTO "creation_execution_dispatches" ("jobId","token","leaseUntil")
      SELECT j."id",${token},CURRENT_TIMESTAMP + interval '30 seconds' FROM "creation_jobs" j
      JOIN "creation_drafts" d ON d."id"=j."draftId"
      WHERE j."ownerId"=${scope.ownerId} AND j."draftId"=${scope.draftId} AND j."requestId"=${scope.requestId}
      AND j."status" IN ('queued','running') AND j."cancelRequestedAt" IS NULL AND d."expiredAt" IS NULL
      ON CONFLICT ("jobId") DO UPDATE SET "token"=EXCLUDED."token","leaseUntil"=EXCLUDED."leaseUntil","runId"=NULL,"updatedAt"=CURRENT_TIMESTAMP
      WHERE "creation_execution_dispatches"."leaseUntil"<=CURRENT_TIMESTAMP
      RETURNING "jobId","token"`;
    return rows[0] ?? null;
  },
  async confirm(jobId: string, token: string, runId: string) {
    await db.$executeRaw`UPDATE "creation_execution_dispatches" SET "runId"=${runId},"leaseUntil"=CURRENT_TIMESTAMP + interval '10 minutes',"updatedAt"=CURRENT_TIMESTAMP
      WHERE "jobId"=${jobId} AND "token"=${token}`;
  },
  async release(jobId: string, token: string) {
    await db.$executeRaw`DELETE FROM "creation_execution_dispatches" WHERE "jobId"=${jobId} AND "token"=${token} AND "runId" IS NULL`;
  },
}; }
export const creationExecutionRepo = createCreationExecutionRepository();
