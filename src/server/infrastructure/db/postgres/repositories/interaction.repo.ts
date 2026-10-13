import 'server-only';
import { prisma as defaultPrisma } from '../client';
import {
  type ActionCommitInput,
  type ActionCommitSuccess,
  type ClaimOutboxOptions,
  type InteractionEventRecord,
  type InteractionOutboxRecord,
  type InteractionRepository,
  type InteractionWorkspaceRecord,
  computePayloadHash,
} from '@/src/server/domain/interaction/repository';
import { planActionCommit } from '@/src/server/domain/interaction/action.service';

export function createPostgresInteractionRepository(prisma = defaultPrisma): InteractionRepository {
  return {
    async createWorkspace<State>(params: {
      id: string;
      ownerId: string;
      domainId: string;
      domainVersion: number;
      initialSnapshot: State;
    }): Promise<InteractionWorkspaceRecord<State>> {
      const existing = await prisma.interactionWorkspace.findUnique({
        where: { id: params.id },
      });
      if (existing) {
        if (existing.ownerId !== params.ownerId) {
          throw new Error('WORKSPACE_OWNER_MISMATCH');
        }
        return {
          id: existing.id,
          ownerId: existing.ownerId,
          domainId: existing.domainId,
          domainVersion: existing.domainVersion,
          snapshot: existing.snapshot as State,
          revision: existing.revision,
          contextEpoch: existing.contextEpoch,
          sequence: existing.sequence,
          lifecycle: existing.lifecycle as InteractionWorkspaceRecord<State>['lifecycle'],
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        };
      }

      const row = await prisma.interactionWorkspace.create({
        data: {
          id: params.id,
          ownerId: params.ownerId,
          domainId: params.domainId,
          domainVersion: params.domainVersion,
          snapshot: params.initialSnapshot as any,
          revision: 0,
          contextEpoch: 0,
          sequence: 0,
          lifecycle: 'active',
        },
      });

      return {
        id: row.id,
        ownerId: row.ownerId,
        domainId: row.domainId,
        domainVersion: row.domainVersion,
        snapshot: row.snapshot as State,
        revision: row.revision,
        contextEpoch: row.contextEpoch,
        sequence: row.sequence,
        lifecycle: row.lifecycle as InteractionWorkspaceRecord<State>['lifecycle'],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async loadWorkspace<State>(params: {
      workspaceId: string;
      ownerId: string;
    }): Promise<InteractionWorkspaceRecord<State> | null> {
      const row = await prisma.interactionWorkspace.findFirst({
        where: { id: params.workspaceId, ownerId: params.ownerId },
      });
      if (!row) return null;

      return {
        id: row.id,
        ownerId: row.ownerId,
        domainId: row.domainId,
        domainVersion: row.domainVersion,
        snapshot: row.snapshot as State,
        revision: row.revision,
        contextEpoch: row.contextEpoch,
        sequence: row.sequence,
        lifecycle: row.lifecycle as InteractionWorkspaceRecord<State>['lifecycle'],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async commitAction<State>(input: ActionCommitInput<State>): Promise<ActionCommitSuccess<State>> {
      return prisma.$transaction(async tx => {
        let payloadHash: string | null = null;
        if (input.requestId) {
          payloadHash = computePayloadHash(input.envelope);
          const existingRequest = await tx.interactionRequest.findUnique({
            where: {
              workspaceId_actorId_operation_requestId: {
                workspaceId: input.workspaceId,
                actorId: input.ownerId,
                operation: 'commitAction',
                requestId: input.requestId,
              },
            },
          });

          if (existingRequest) {
            if (existingRequest.payloadHash !== payloadHash) {
              throw new Error('IDEMPOTENCY_MISMATCH');
            }
            return existingRequest.response as unknown as ActionCommitSuccess<State>;
          }
        }

        // Lock workspace row to prevent concurrent mutations
        const rows = await tx.$queryRaw<
          Array<{
            id: string;
            ownerId: string;
            domainId: string;
            domainVersion: number;
            snapshot: unknown;
            revision: number;
            contextEpoch: number;
            sequence: number;
            lifecycle: string;
          }>
        >`
          SELECT "id", "ownerId", "domainId", "domainVersion", "snapshot", "revision", "contextEpoch", "sequence", "lifecycle"
          FROM "interaction_workspaces"
          WHERE "id" = ${input.workspaceId} AND "ownerId" = ${input.ownerId}
          FOR UPDATE
        `;

        const workspace = rows[0];
        if (!workspace) {
          throw new Error('WORKSPACE_NOT_FOUND');
        }
        if (workspace.lifecycle !== 'active') {
          throw new Error('WORKSPACE_NOT_ACTIVE');
        }
        if (workspace.revision !== input.expectedRevision) {
          throw new Error('STALE_WORKSPACE');
        }

        const commitResult = planActionCommit({
          state: workspace.snapshot as State,
          currentRevision: workspace.revision,
          envelope: input.envelope,
          plan: input.plan,
        });

        const nextSequence = workspace.sequence + 1;

        await tx.interactionWorkspace.update({
          where: { id: input.workspaceId },
          data: {
            snapshot: commitResult.state as any,
            revision: commitResult.revision,
            sequence: nextSequence,
          },
        });

        await tx.interactionEvent.create({
          data: {
            id: crypto.randomUUID(),
            workspaceId: input.workspaceId,
            sequence: nextSequence,
            protocolVersion: 1,
            type: 'workspace.committed',
            revision: commitResult.revision,
            payload: {
              receipt: commitResult.receipt,
              baseRevision: input.expectedRevision,
              revision: commitResult.revision,
              changeSet: commitResult.receipt.changed,
            } as any,
          },
        });

        if (input.outboxItems && input.outboxItems.length > 0) {
          const now = new Date();
          await tx.interactionOutbox.createMany({
            data: input.outboxItems.map(item => ({
              id: crypto.randomUUID(),
              workspaceId: input.workspaceId,
              kind: item.kind,
              payload: item.payload as any,
              dedupKey: item.dedupKey,
              status: 'pending',
              attempts: 0,
              dueAt: now,
            })),
            skipDuplicates: true,
          });
        }

        const successResponse: ActionCommitSuccess<State> = {
          state: commitResult.state,
          revision: commitResult.revision,
          sequence: nextSequence,
          receipt: commitResult.receipt,
        };

        if (input.requestId && payloadHash) {
          await tx.interactionRequest.create({
            data: {
              id: crypto.randomUUID(),
              workspaceId: input.workspaceId,
              actorId: input.ownerId,
              operation: 'commitAction',
              requestId: input.requestId,
              payloadHash,
              response: successResponse as any,
            },
          });
        }

        return successResponse;
      });
    },

    async queryEvents(params: {
      workspaceId: string;
      ownerId: string;
      afterSequence?: number;
      limit?: number;
    }): Promise<InteractionEventRecord[]> {
      const workspace = await prisma.interactionWorkspace.findFirst({
        where: { id: params.workspaceId, ownerId: params.ownerId },
        select: { id: true },
      });
      if (!workspace) {
        throw new Error('WORKSPACE_NOT_FOUND');
      }

      const rows = await prisma.interactionEvent.findMany({
        where: {
          workspaceId: params.workspaceId,
          sequence: { gt: params.afterSequence ?? 0 },
        },
        orderBy: { sequence: 'asc' },
        take: params.limit ?? 100,
      });

      return rows.map(r => ({
        id: r.id,
        workspaceId: r.workspaceId,
        sequence: r.sequence,
        protocolVersion: r.protocolVersion,
        type: r.type,
        revision: r.revision,
        payload: r.payload,
        createdAt: r.createdAt,
      }));
    },

    async claimOutbox(options: ClaimOutboxOptions): Promise<InteractionOutboxRecord[]> {
      const now = options.now ?? new Date();
      const limit = options.limit ?? 10;
      const leaseUntil = new Date(now.getTime() + options.leaseDurationMs);

      return prisma.$transaction(async tx => {
        const candidates = await tx.interactionOutbox.findMany({
          where: {
            dueAt: { lte: now },
            OR: [
              { status: 'pending' },
              { status: 'delivering', leaseUntil: { lt: now } },
            ],
          },
          orderBy: { dueAt: 'asc' },
          take: limit,
        });

        if (candidates.length === 0) return [];

        const ids = candidates.map(c => c.id);
        await tx.interactionOutbox.updateMany({
          where: { id: { in: ids } },
          data: {
            status: 'delivering',
            leaseOwner: options.leaseOwner,
            leaseToken: options.leaseToken,
            leaseUntil,
            attempts: { increment: 1 },
          },
        });

        const claimed = await tx.interactionOutbox.findMany({
          where: { id: { in: ids } },
        });

        return claimed.map(c => ({
          id: c.id,
          workspaceId: c.workspaceId,
          kind: c.kind,
          payload: c.payload,
          dedupKey: c.dedupKey,
          status: c.status as InteractionOutboxRecord['status'],
          attempts: c.attempts,
          dueAt: c.dueAt,
          leaseOwner: c.leaseOwner,
          leaseToken: c.leaseToken,
          leaseUntil: c.leaseUntil,
          deliveredAt: c.deliveredAt,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }));
      });
    },

    async ackOutbox(params: {
      ids: string[];
      leaseToken: string;
      now?: Date;
    }): Promise<number> {
      const now = params.now ?? new Date();
      const res = await prisma.interactionOutbox.updateMany({
        where: {
          id: { in: params.ids },
          status: 'delivering',
          leaseToken: params.leaseToken,
        },
        data: {
          status: 'delivered',
          deliveredAt: now,
          leaseOwner: null,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return res.count;
    },

    async failOutbox(params: {
      id: string;
      leaseToken: string;
      retryInMs?: number;
      now?: Date;
    }): Promise<boolean> {
      const now = params.now ?? new Date();
      const retryDue = new Date(now.getTime() + (params.retryInMs ?? 5_000));
      const res = await prisma.interactionOutbox.updateMany({
        where: {
          id: params.id,
          status: 'delivering',
          leaseToken: params.leaseToken,
        },
        data: {
          status: 'pending',
          dueAt: retryDue,
          leaseOwner: null,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return res.count > 0;
    },
  };
}

export const postgresInteractionRepo = createPostgresInteractionRepository();
