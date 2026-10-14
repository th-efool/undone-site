import 'server-only';
import { prisma as defaultPrisma } from '../client';
import { Prisma } from '@/generated/prisma/client';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { textDriver } from '@/src/server/domain/cohort-builder/text-driver';
import { reconcileTextAction } from '@/src/server/domain/cohort-builder/text-action-jobs';
import { admitPendingAssistantMessage } from '../assistant-queue';
import {
  type ActionCommitInput,
  type ActionCommitSuccess,
  type AppendMessageInput,
  type ClaimOutboxOptions,
  type InteractionEventRecord,
  type InteractionMessageRecord,
  type InteractionOutboxRecord,
  type InteractionRepository,
  type InteractionWorkspaceRecord,
  type InteractionRunRecord,
  type InteractionStepRecord,
  type InteractionProposalRecord,
  computePayloadHash,
  planActionCommit,
} from 'interaction-builder/runtime';

function mapRun(row: {
  id: string;
  workspaceId: string;
  triggeringMessageId: string | null;
  status: string;
  contextEpoch: number;
  observedRevision: number;
  cursor: number;
  fence: number;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseUntil: Date | null;
  deadline: Date | null;
  budgetReservation: unknown;
  budgetActual: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InteractionRunRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    triggeringMessageId: row.triggeringMessageId,
    status: row.status as InteractionRunRecord['status'],
    contextEpoch: row.contextEpoch,
    observedRevision: row.observedRevision,
    cursor: row.cursor,
    fence: row.fence,
    leaseOwner: row.leaseOwner,
    leaseToken: row.leaseToken,
    leaseUntil: row.leaseUntil,
    deadline: row.deadline,
    budgetReservation: row.budgetReservation,
    budgetActual: row.budgetActual,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapStep(row: {
  id: string;
  runId: string;
  ordinal: number;
  kind: string;
  toolName: string | null;
  inputHash: string | null;
  inputPayload: unknown;
  state: string;
  result: unknown;
  error: string | null;
  effectKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InteractionStepRecord {
  return {
    id: row.id,
    runId: row.runId,
    ordinal: row.ordinal,
    kind: row.kind as InteractionStepRecord['kind'],
    toolName: row.toolName,
    inputHash: row.inputHash,
    inputPayload: row.inputPayload,
    state: row.state as InteractionStepRecord['state'],
    result: row.result,
    error: row.error,
    effectKey: row.effectKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapProposal(row: {
  id: string;
  workspaceId: string;
  actionPayload: unknown;
  readSet: unknown;
  summary: string;
  state: string;
  expiresAt: Date | null;
  decisionActor: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InteractionProposalRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    actionPayload: row.actionPayload,
    readSet: row.readSet,
    summary: row.summary,
    state: row.state as InteractionProposalRecord['state'],
    expiresAt: row.expiresAt,
    decisionActor: row.decisionActor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPostgresInteractionRepository(prisma = defaultPrisma): InteractionRepository {
  return {
    async appendMessage(input: AppendMessageInput) {
      const payload = { id: input.id, role: input.role, parts: input.parts, runId: input.runId ?? null };
      return prisma.$transaction(async tx => {
        let hash: string | null = null;
        if (input.requestId) {
          hash = computePayloadHash(payload);
          const prior = await tx.interactionRequest.findUnique({
            where: {
              workspaceId_actorId_operation_requestId: {
                workspaceId: input.workspaceId,
                actorId: input.ownerId,
                operation: 'appendMessage',
                requestId: input.requestId,
              },
            },
          });
          if (prior) {
            if (prior.payloadHash !== hash) throw new Error('IDEMPOTENCY_MISMATCH');
            return prior.response as unknown as { message: InteractionMessageRecord; sequence: number; run?: InteractionRunRecord };
          }
        }
        const rows = await tx.$queryRaw<Array<{ sequence: number; lifecycle: string; contextEpoch: number; revision: number }>>`
          SELECT "sequence", "lifecycle", "contextEpoch", "revision" FROM "interaction_workspaces"
          WHERE "id" = ${input.workspaceId} AND "ownerId" = ${input.ownerId} FOR UPDATE`;
        const ws = rows[0];
        if (!ws) throw new Error('WORKSPACE_NOT_FOUND');
        if (ws.lifecycle !== 'active') throw new Error('WORKSPACE_NOT_ACTIVE');
        // Another request may have committed while this transaction waited for the row lock.
        if (input.requestId && hash) {
          const prior = await tx.interactionRequest.findUnique({ where: { workspaceId_actorId_operation_requestId: {
            workspaceId: input.workspaceId, actorId: input.ownerId, operation: 'appendMessage', requestId: input.requestId,
          } } });
          if (prior) {
            if (prior.payloadHash !== hash) throw new Error('IDEMPOTENCY_MISMATCH');
            return prior.response as unknown as { message: InteractionMessageRecord; sequence: number; run?: InteractionRunRecord };
          }
        }

        if (input.role === 'assistant' && input.runId) {
          const run = await tx.interactionRun.findUnique({ where: { id: input.runId } });
          if (!run || run.workspaceId !== input.workspaceId || run.status !== 'running' || !run.leaseUntil || run.leaseUntil < new Date()) throw new Error('RUN_CANCELED');
          const lease = (input as AppendMessageInput & { runLeaseToken?: string }).runLeaseToken;
          if (lease !== undefined && run.leaseToken !== lease) throw new Error('FENCE_EXPIRED');
        }
        if (input.role === 'user' && input.scheduleRun !== false) {
          const pending = await tx.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM interaction_messages m
            WHERE m."workspaceId"=${input.workspaceId} AND m.role='user'
              AND NOT EXISTS (SELECT 1 FROM interaction_runs r WHERE r."workspaceId"=m."workspaceId" AND r."triggeringMessageId"=m.id)`;
          if (pending[0].count >= 5) throw new Error('MESSAGE_QUEUE_FULL');
        }
        const sequence = ws.sequence + 1;
        await tx.interactionWorkspace.update({ where: { id: input.workspaceId }, data: { sequence } });

        const row = await tx.interactionMessage.create({
          data: {
            id: input.id,
            workspaceId: input.workspaceId,
            role: input.role,
            parts: input.parts as never,
            sequence,
            runId: input.runId ?? null,
          },
        });
        const message: InteractionMessageRecord = {
          id: row.id,
          workspaceId: row.workspaceId,
          role: row.role as InteractionMessageRecord['role'],
          parts: row.parts as unknown[],
          sequence: row.sequence,
          runId: row.runId,
          createdAt: row.createdAt,
        };

        await tx.interactionEvent.create({
          data: {
            id: crypto.randomUUID(),
            workspaceId: input.workspaceId,
            sequence,
            protocolVersion: 1,
            type: 'message.accepted',
            revision: null,
            payload: { message } as never,
          },
        });

        let scheduledRun: InteractionRunRecord | undefined;
        // Admission also drains older pending turns before this newly submitted turn.
        if (input.scheduleRun !== false && input.role === 'user') {
          const admitted = await admitPendingAssistantMessage(tx, input.workspaceId);
          if (admitted) scheduledRun = mapRun(admitted);
        }
        const result = { message, sequence, run: scheduledRun };
        if (input.requestId && hash) {
          await tx.interactionRequest.create({
            data: {
              id: crypto.randomUUID(),
              workspaceId: input.workspaceId,
              actorId: input.ownerId,
              operation: 'appendMessage',
              requestId: input.requestId,
              payloadHash: hash,
              response: result as never,
            },
          });
        }
        return result;
      });
    },

    async listMessages(p) {
      const ws = await prisma.interactionWorkspace.findFirst({ where: { id: p.workspaceId, ownerId: p.ownerId }, select: { id: true } });
      if (!ws) throw new Error('WORKSPACE_NOT_FOUND');
      const rows = await prisma.interactionMessage.findMany({
        where: { workspaceId: p.workspaceId, ...(p.beforeSequence !== undefined ? { sequence: { lt: p.beforeSequence } } : {}) },
        orderBy: { sequence: 'desc' },
        take: p.limit ?? 50,
      });
      return rows.reverse().map(r => ({ id: r.id, workspaceId: r.workspaceId, role: r.role as InteractionMessageRecord['role'], parts: r.parts as unknown[], sequence: r.sequence, runId: r.runId, createdAt: r.createdAt }));
    },

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

        if (input.runFence) {
          const run = await tx.interactionRun.findUnique({
            where: { id: input.runFence.runId },
          });
          if (!run || run.status === 'canceled') {
            throw new Error('RUN_CANCELED');
          }
          if (run.leaseToken !== input.runFence.leaseToken) {
            throw new Error('FENCE_EXPIRED');
          }
          if (run.leaseUntil && run.leaseUntil < new Date()) {
            throw new Error('FENCE_EXPIRED');
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
        if (input.requestId && payloadHash) {
          const prior = await tx.interactionRequest.findUnique({ where: { workspaceId_actorId_operation_requestId: {
            workspaceId: input.workspaceId, actorId: input.ownerId, operation: 'commitAction', requestId: input.requestId,
          } } });
          if (prior) {
            if (prior.payloadHash !== payloadHash) throw new Error('IDEMPOTENCY_MISMATCH');
            return prior.response as unknown as ActionCommitSuccess<State>;
          }
        }
        if (workspace.lifecycle !== 'active') {
          throw new Error('WORKSPACE_NOT_ACTIVE');
        }
        // Cancellation and acceptance serialize on this lock; recheck after waiting for it.
        if (input.runFence) {
          const run = await tx.interactionRun.findUnique({ where: { id: input.runFence.runId } });
          if (!run || run.workspaceId !== input.workspaceId || run.status !== 'running') throw new Error('RUN_CANCELED');
          if (run.leaseToken !== input.runFence.leaseToken || !run.leaseUntil || run.leaseUntil < new Date()) throw new Error('FENCE_EXPIRED');
        }
        if (workspace.domainId === 'cohort' && cohortWorkspaceSchema.parse(workspace.snapshot).processing.driver === 'durable' && textDriver() !== 'durable') {
          throw new Error('TEXT_DRIVER_MISMATCH');
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

        if (workspace.domainId === 'cohort' && textDriver() === 'durable') {
          // Static application SQL, all values bound separately on the same transaction.
          commitResult.state = await reconcileTextAction({ query: async (statement, parameters) => ({
            rows: await tx.$queryRawUnsafe<Record<string, unknown>[]>(statement, ...parameters),
          }) }, input.workspaceId, cohortWorkspaceSchema.parse(commitResult.state), (input.envelope as { action: unknown }).action) as State;
        }

        await tx.interactionWorkspace.update({
          where: { id: input.workspaceId },
          data: {
            snapshot: commitResult.state as any,
            revision: commitResult.revision,
            contextEpoch: { increment: 1 },
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

    /** Assistant Runs Lifecycle */
    async scheduleRun(params: {
      workspaceId: string;
      ownerId: string;
      triggeringMessageId?: string | null;
      observedRevision?: number;
      runId?: string;
    }): Promise<InteractionRunRecord> {
      return prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw<Array<{ id: string; revision: number; sequence: number; contextEpoch: number }>>`
          SELECT "id", "revision", "sequence", "contextEpoch" FROM "interaction_workspaces"
          WHERE "id" = ${params.workspaceId} AND "ownerId" = ${params.ownerId} FOR UPDATE`;
        const ws = rows[0];
        if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

        const active = await tx.interactionRun.findFirst({
          where: { workspaceId: params.workspaceId, status: { in: ['queued', 'running'] } },
        });
        if (active) return mapRun(active);
        if (!params.triggeringMessageId) {
          const pending = await admitPendingAssistantMessage(tx, params.workspaceId);
          if (pending) return mapRun(pending);
        }

        const runId = params.runId ?? crypto.randomUUID();
        const runRow = await tx.interactionRun.create({
          data: {
            id: runId,
            workspaceId: params.workspaceId,
            triggeringMessageId: params.triggeringMessageId ?? null,
            status: 'queued',
            contextEpoch: ws.contextEpoch ?? 0,
            observedRevision: params.observedRevision ?? ws.revision ?? 0,
            cursor: ws.sequence,
            fence: 0,
          },
        });
        await tx.interactionOutbox.create({
          data: {
            id: crypto.randomUUID(),
            workspaceId: params.workspaceId,
            kind: 'assistant_run',
            payload: { runId, workspaceId: params.workspaceId } as never,
            dedupKey: `run:${runId}`,
            status: 'pending',
            attempts: 0,
            dueAt: new Date(),
          },
        });

        const nextSeq = ws.sequence + 1;
        await tx.interactionWorkspace.update({
          where: { id: params.workspaceId },
          data: { sequence: nextSeq },
        });
        await tx.interactionEvent.create({
          data: {
            id: crypto.randomUUID(),
            workspaceId: params.workspaceId,
            sequence: nextSeq,
            protocolVersion: 1,
            type: 'run.changed',
            revision: null,
            payload: { run: mapRun(runRow) } as never,
          },
        });

        return mapRun(runRow);
      });
    },

    async claimRun(params: {
      leaseOwner: string;
      leaseToken: string;
      leaseDurationMs: number;
      workspaceId?: string;
      now?: Date;
    }): Promise<InteractionRunRecord | null> {
      const now = params.now ?? new Date();
      const leaseUntil = new Date(now.getTime() + params.leaseDurationMs);

      return prisma.$transaction(async tx => {
        const candidates = await tx.$queryRaw<Array<{ id: string; workspaceId: string; status: string }>>`
          SELECT r."id", r."workspaceId", r."status" FROM "interaction_runs" r
          JOIN interaction_workspaces w ON w.id=r."workspaceId"
          WHERE w.lifecycle='active' AND (r."status" = 'queued' OR (r."status" = 'running' AND r."leaseUntil" < ${now}))
          ${params.workspaceId ? Prisma.sql`AND r."workspaceId" = ${params.workspaceId}` : Prisma.empty}
          ORDER BY r."createdAt" ASC
          LIMIT 1
          FOR UPDATE OF w SKIP LOCKED
        `;

        if (candidates.length === 0) return null;
        const candidateId = candidates[0].id;
        const locked = (await tx.$queryRaw<Array<{ sequence: number; revision: number; contextEpoch: number }>>`
          SELECT "sequence", "revision", "contextEpoch" FROM "interaction_workspaces"
          WHERE "id" = ${candidates[0].workspaceId} FOR UPDATE`)[0];
        if (!locked) return null;

        const updated = await tx.interactionRun.update({
          where: { id: candidateId },
          data: {
            status: 'running',
            leaseOwner: params.leaseOwner,
            leaseToken: params.leaseToken,
            leaseUntil,
            fence: { increment: 1 },
            ...(candidates[0].status === 'queued' ? { observedRevision: locked.revision, contextEpoch: locked.contextEpoch } : {}),
          },
        });

        const ws = locked;
        if (ws) {
          const nextSeq = ws.sequence + 1;
          await tx.interactionWorkspace.update({
            where: { id: updated.workspaceId },
            data: { sequence: nextSeq },
          });
          await tx.interactionEvent.create({
            data: {
              id: crypto.randomUUID(),
              workspaceId: updated.workspaceId,
              sequence: nextSeq,
              protocolVersion: 1,
              type: 'run.changed',
              revision: null,
              payload: { run: mapRun(updated) } as never,
            },
          });
        }

        return mapRun(updated);
      });
    },

    async heartbeatRun(params: {
      runId: string;
      leaseToken: string;
      leaseDurationMs: number;
      now?: Date;
    }): Promise<boolean> {
      const now = params.now ?? new Date();
      const leaseUntil = new Date(now.getTime() + params.leaseDurationMs);
      const res = await prisma.interactionRun.updateMany({
        where: {
          id: params.runId,
          leaseToken: params.leaseToken,
          status: 'running',
          leaseUntil: { gt: now },
        },
        data: {
          leaseUntil,
        },
      });
      return res.count > 0;
    },

    async cancelRun(params: {
      runId: string;
      workspaceId: string;
      ownerId: string;
      reason?: string;
      now?: Date;
    }): Promise<boolean> {
      return prisma.$transaction(async tx => {
        const ws = (await tx.$queryRaw<Array<{ sequence: number }>>`SELECT sequence FROM interaction_workspaces
          WHERE id=${params.workspaceId} AND "ownerId"=${params.ownerId} FOR UPDATE`)[0];
        if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

        const run = await tx.interactionRun.findUnique({ where: { id: params.runId } });
        if (!run || run.workspaceId !== params.workspaceId) return false;
        if (run.status === 'canceled') return true;
        if (run.status === 'completed' || run.status === 'failed') return false;

        const updated = await tx.interactionRun.update({
          where: { id: params.runId },
          data: {
            status: 'canceled',
            fence: { increment: 1 },
            error: params.reason ?? 'Canceled by user',
          },
        });

        const nextSeq = ws.sequence + 1;
        await tx.interactionWorkspace.update({
          where: { id: params.workspaceId },
          data: { sequence: nextSeq },
        });
        await tx.interactionEvent.create({
          data: {
            id: crypto.randomUUID(),
            workspaceId: params.workspaceId,
            sequence: nextSeq,
            protocolVersion: 1,
            type: 'run.changed',
            revision: null,
            payload: { run: mapRun(updated) } as never,
          },
        });

        await admitPendingAssistantMessage(tx, params.workspaceId);
        return true;
      });
    },

    async completeRun(params: {
      runId: string;
      leaseToken: string;
      assistantMessageId?: string | null;
      budgetActual?: unknown;
      now?: Date;
    }): Promise<boolean> {
      return prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT w.id FROM interaction_workspaces w JOIN interaction_runs r ON r."workspaceId"=w.id
          WHERE r.id=${params.runId} FOR UPDATE OF w`;
        const run = await tx.interactionRun.findUnique({ where: { id: params.runId } });
        if (!run || run.leaseToken !== params.leaseToken || run.status !== 'running' || !run.leaseUntil || run.leaseUntil < (params.now ?? new Date())) return false;

        const updated = await tx.interactionRun.update({
          where: { id: params.runId },
          data: {
            status: 'completed',
            leaseOwner: null,
            leaseToken: null,
            leaseUntil: null,
            budgetActual: (params.budgetActual ?? null) as never,
          },
        });

        const ws = await tx.interactionWorkspace.findUnique({
          where: { id: run.workspaceId },
          select: { sequence: true },
        });
        if (ws) {
          const nextSeq = ws.sequence + 1;
          await tx.interactionWorkspace.update({
            where: { id: run.workspaceId },
            data: { sequence: nextSeq },
          });
          await tx.interactionEvent.create({
            data: {
              id: crypto.randomUUID(),
              workspaceId: run.workspaceId,
              sequence: nextSeq,
              protocolVersion: 1,
              type: 'run.changed',
              revision: null,
              payload: { run: mapRun(updated), assistantMessageId: params.assistantMessageId ?? null } as never,
            },
          });
        }

        await admitPendingAssistantMessage(tx, run.workspaceId);
        return true;
      });
    },

    async failRun(params: {
      runId: string;
      leaseToken: string;
      error: string;
      budgetActual?: unknown;
      now?: Date;
    }): Promise<boolean> {
      return prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT w.id FROM interaction_workspaces w JOIN interaction_runs r ON r."workspaceId"=w.id
          WHERE r.id=${params.runId} FOR UPDATE OF w`;
        const run = await tx.interactionRun.findUnique({ where: { id: params.runId } });
        if (!run || run.leaseToken !== params.leaseToken || run.status !== 'running' || !run.leaseUntil || run.leaseUntil < (params.now ?? new Date())) return false;

        const updated = await tx.interactionRun.update({
          where: { id: params.runId },
          data: {
            status: 'failed',
            error: params.error,
            leaseOwner: null,
            leaseToken: null,
            leaseUntil: null,
            budgetActual: (params.budgetActual ?? null) as never,
          },
        });

        const ws = await tx.interactionWorkspace.findUnique({
          where: { id: run.workspaceId },
          select: { sequence: true },
        });
        if (ws) {
          const nextSeq = ws.sequence + 1;
          await tx.interactionWorkspace.update({
            where: { id: run.workspaceId },
            data: { sequence: nextSeq },
          });
          await tx.interactionEvent.create({
            data: {
              id: crypto.randomUUID(),
              workspaceId: run.workspaceId,
              sequence: nextSeq,
              protocolVersion: 1,
              type: 'run.changed',
              revision: null,
              payload: { run: mapRun(updated), error: params.error } as never,
            },
          });
        }

        await admitPendingAssistantMessage(tx, run.workspaceId);
        return true;
      });
    },

    async getRun(params: {
      runId: string;
      workspaceId?: string;
    }): Promise<InteractionRunRecord | null> {
      const run = await prisma.interactionRun.findUnique({ where: { id: params.runId } });
      if (!run) return null;
      if (params.workspaceId && run.workspaceId !== params.workspaceId) return null;
      return mapRun(run);
    },

    async getActiveRun(params: {
      workspaceId: string;
      ownerId: string;
    }): Promise<InteractionRunRecord | null> {
      const ws = await prisma.interactionWorkspace.findFirst({
        where: { id: params.workspaceId, ownerId: params.ownerId },
        select: { id: true },
      });
      if (!ws) throw new Error('WORKSPACE_NOT_FOUND');
      const run = await prisma.interactionRun.findFirst({
        where: { workspaceId: params.workspaceId, status: { in: ['queued', 'running'] } },
      });
      return run ? mapRun(run) : null;
    },

    /** Execution Journal (Steps) */
    async recordStep(params: {
      runId: string;
      leaseToken: string;
      ordinal: number;
      kind: 'model_call' | 'tool_call';
      toolName?: string;
      inputHash?: string;
      inputPayload?: unknown;
      state: 'started' | 'completed' | 'failed';
      result?: unknown;
      error?: string;
      effectKey?: string;
    }): Promise<InteractionStepRecord> {
      return prisma.$transaction(async tx => {
        const run = await tx.interactionRun.findUnique({ where: { id: params.runId } });
        if (!run || run.leaseToken !== params.leaseToken) throw new Error('FENCE_EXPIRED');

        const existing = await tx.interactionStep.findUnique({
          where: { runId_ordinal: { runId: params.runId, ordinal: params.ordinal } },
        });

        if (existing) {
          if (existing.state === 'completed' && params.state !== 'completed') {
            return mapStep(existing);
          }
          const updated = await tx.interactionStep.update({
            where: { id: existing.id },
            data: {
              state: params.state,
              result: params.result !== undefined ? (params.result as never) : (existing.result as never),
              error: params.error !== undefined ? params.error : existing.error,
            },
          });
          return mapStep(updated);
        }

        const created = await tx.interactionStep.create({
          data: {
            id: crypto.randomUUID(),
            runId: params.runId,
            ordinal: params.ordinal,
            kind: params.kind,
            toolName: params.toolName ?? null,
            inputHash: params.inputPayload ? computePayloadHash(params.inputPayload) : null,
            inputPayload: (params.inputPayload ?? null) as never,
            state: params.state,
            result: (params.result ?? null) as never,
            error: params.error ?? null,
            effectKey: params.effectKey ?? null,
          },
        });
        return mapStep(created);
      });
    },

    async listSteps(params: { runId: string }): Promise<InteractionStepRecord[]> {
      const steps = await prisma.interactionStep.findMany({
        where: { runId: params.runId },
        orderBy: { ordinal: 'asc' },
      });
      return steps.map(mapStep);
    },

    /** Proposals Lifecycle */
    async createProposal(params: {
      workspaceId: string;
      ownerId: string;
      id?: string;
      actionPayload: unknown;
      summary: string;
      readSet?: unknown;
      expiresAt?: Date;
    }): Promise<InteractionProposalRecord> {
      const ws = await prisma.interactionWorkspace.findFirst({
        where: { id: params.workspaceId, ownerId: params.ownerId },
        select: { id: true },
      });
      if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

      const proposal = await prisma.interactionProposal.create({
        data: {
          id: params.id ?? crypto.randomUUID(),
          workspaceId: params.workspaceId,
          actionPayload: params.actionPayload as never,
          readSet: (params.readSet ?? null) as never,
          summary: params.summary,
          state: 'pending',
          expiresAt: params.expiresAt ?? null,
        },
      });
      return mapProposal(proposal);
    },

    async resolveProposal(params: {
      proposalId: string;
      workspaceId: string;
      ownerId: string;
      decision: 'accepted' | 'rejected';
      decisionActor: string;
    }): Promise<InteractionProposalRecord> {
      const ws = await prisma.interactionWorkspace.findFirst({
        where: { id: params.workspaceId, ownerId: params.ownerId },
        select: { id: true },
      });
      if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

      const proposal = await prisma.interactionProposal.findUnique({
        where: { id: params.proposalId },
      });
      if (!proposal || proposal.workspaceId !== params.workspaceId) throw new Error('PROPOSAL_NOT_FOUND');
      if (proposal.state !== 'pending') throw new Error('STALE_PROPOSAL');
      if (proposal.expiresAt && proposal.expiresAt < new Date()) {
        await prisma.interactionProposal.update({
          where: { id: params.proposalId },
          data: { state: 'expired' },
        });
        throw new Error('PROPOSAL_EXPIRED');
      }

      const updated = await prisma.interactionProposal.update({
        where: { id: params.proposalId },
        data: {
          state: params.decision,
          decisionActor: params.decisionActor,
        },
      });
      return mapProposal(updated);
    },

    async getProposal(params: {
      proposalId: string;
      workspaceId: string;
      ownerId: string;
    }): Promise<InteractionProposalRecord | null> {
      const ws = await prisma.interactionWorkspace.findFirst({
        where: { id: params.workspaceId, ownerId: params.ownerId },
        select: { id: true },
      });
      if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

      const p = await prisma.interactionProposal.findUnique({
        where: { id: params.proposalId },
      });
      return p && p.workspaceId === params.workspaceId ? mapProposal(p) : null;
    },

    async listProposals(params: {
      workspaceId: string;
      ownerId: string;
      state?: string;
    }): Promise<InteractionProposalRecord[]> {
      const ws = await prisma.interactionWorkspace.findFirst({
        where: { id: params.workspaceId, ownerId: params.ownerId },
        select: { id: true },
      });
      if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

      const proposals = await prisma.interactionProposal.findMany({
        where: {
          workspaceId: params.workspaceId,
          ...(params.state ? { state: params.state } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      return proposals.map(mapProposal);
    },
  };
}

export const postgresInteractionRepo = createPostgresInteractionRepository();
