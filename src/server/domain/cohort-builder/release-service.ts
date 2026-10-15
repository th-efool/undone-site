import 'server-only';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import {
  type CohortWorkspace,
  cohortWorkspaceSchema,
} from '@/src/shared/cohort-builder/contracts';
import {
  validateCohortReadiness,
  freezeCohortCandidate,
  executeIdempotentRelease,
  CohortReadinessError,
  type ReleaseReceipt,
} from './release';
import { materializeLearnerCohort } from './delivery.adapter';
import { PostgresReleaseEffectStore } from './release-store';

export interface ReleaseWorkspaceParams {
  workspaceId: string;
  ownerId: string;
  mode: 'private_activation' | 'public_publish';
  operationId?: string;
  expectedRevision?: number;
}

export interface ReleaseWorkspaceResult {
  receipt: ReleaseReceipt;
  revision: number;
}

/**
 * End-to-end transactional release service for cohort workspaces.
 * Validates readiness, freezes snapshot, commits relational learner records under CAS,
 * persists idempotent effect receipt, and records the canonical release event.
 */
export async function releaseWorkspace(
  prisma: PrismaClient | Prisma.TransactionClient,
  params: ReleaseWorkspaceParams
): Promise<ReleaseWorkspaceResult> {
  const executeInTransaction = async (tx: Prisma.TransactionClient): Promise<ReleaseWorkspaceResult> => {
    // 1. Lock workspace row and verify ownership
    const rows = await tx.$queryRawUnsafe<
      {
        id: string;
        ownerId: string;
        domainId: string;
        snapshot: unknown;
        revision: number;
        sequence: number;
        contextEpoch: number;
        lifecycle: string;
      }[]
    >(
      `SELECT "id", "ownerId", "domainId", "snapshot", "revision", "sequence", "contextEpoch", "lifecycle"
       FROM "interaction_workspaces"
       WHERE "id" = $1
       FOR UPDATE`,
      params.workspaceId
    );

    const workspaceRow = rows[0];
    if (!workspaceRow) {
      throw new Error('WORKSPACE_NOT_FOUND: Workspace does not exist.');
    }
    if (workspaceRow.ownerId !== params.ownerId) {
      throw new Error('UNAUTHORIZED_OWNER: Only the workspace owner can release a cohort.');
    }
    if (workspaceRow.lifecycle === 'archived') {
      throw new Error('WORKSPACE_ARCHIVED: Archived workspaces cannot be released.');
    }
    if (params.expectedRevision !== undefined && workspaceRow.revision !== params.expectedRevision) {
      throw new Error(`STALE_WORKSPACE: Workspace was modified since approval (expected revision ${params.expectedRevision}, found ${workspaceRow.revision}).`);
    }

    // 2. Validate workspace readiness
    const workspace = cohortWorkspaceSchema.parse(workspaceRow.snapshot);
    const readiness = validateCohortReadiness(workspace, params.mode);
    if (!readiness.ready) {
      throw new CohortReadinessError(readiness);
    }

    // 3. Freeze candidate snapshot
    const frozen = freezeCohortCandidate(workspace, {
      workspaceId: params.workspaceId,
      workspaceRevision: workspaceRow.revision,
      mode: params.mode,
    });

    // Downgrade protection: A public cohort cannot be downgraded to private
    const existingCohort = await tx.cohort.findUnique({
      where: { id: frozen.cohortId },
      select: { id: true, visibility: true },
    });
    if (existingCohort && params.mode === 'private_activation' && existingCohort.visibility === 'PUBLIC') {
      throw new Error('CANNOT_DOWNGRADE_PUBLIC_COHORT: A publicly published cohort cannot be downgraded to private activation.');
    }

    // 4. Initialize Postgres release store
    const store = new PostgresReleaseEffectStore({
      query: async (statement, sqlParams) => ({
        rows: await tx.$queryRawUnsafe<Record<string, unknown>[]>(statement, ...(sqlParams ?? [])),
      }),
    });

    // 5. Idempotent release execution and relational learner materialization
    const receipt = await executeIdempotentRelease(
      store,
      frozen,
      async candidate => {
        await materializeLearnerCohort(tx, params.ownerId, candidate.delivery);
      },
      { operationId: params.operationId }
    );

    // 6. If already released with identical receipt, return without extra mutations
    if (
      workspace.release?.status === 'released' &&
      workspace.release?.candidateHash === frozen.snapshotHash &&
      workspace.release?.effectKey === receipt.effectKey
    ) {
      return { receipt, revision: workspaceRow.revision };
    }

    // 7. Update workspace snapshot and sequence under row lock
    const nextRevision = workspaceRow.revision + 1;
    const nextSequence = workspaceRow.sequence + 1;

    const nextWorkspace: CohortWorkspace = {
      ...workspace,
      release: {
        status: 'released',
        mode: params.mode,
        candidateHash: frozen.snapshotHash,
        effectKey: receipt.effectKey,
        cohortId: receipt.cohortId,
        releasedAt: receipt.releasedAt,
        receipt,
      },
    };

    await tx.interactionWorkspace.update({
      where: { id: params.workspaceId },
      data: {
        snapshot: nextWorkspace as any,
        revision: nextRevision,
        contextEpoch: { increment: 1 },
        sequence: nextSequence,
        updatedAt: new Date(),
      },
    });

    // 8. Record canonical event
    await tx.interactionEvent.create({
      data: {
        workspaceId: params.workspaceId,
        sequence: nextSequence,
        protocolVersion: 1,
        type: 'cohort.released',
        revision: nextRevision,
        payload: {
          effectKey: receipt.effectKey,
          cohortId: receipt.cohortId,
          mode: receipt.mode,
          contentHash: receipt.contentHash,
          releasedAt: receipt.releasedAt,
          destinationUrl: receipt.destinationUrl,
        } as Prisma.InputJsonValue,
      },
    });

    return { receipt, revision: nextRevision };
  };

  // If already in a transaction client, reuse it; otherwise create interactive transaction
  if ('$transaction' in prisma && typeof prisma.$transaction === 'function') {
    return (prisma as PrismaClient).$transaction(executeInTransaction, { timeout: 15_000 });
  }
  return executeInTransaction(prisma as Prisma.TransactionClient);
}
