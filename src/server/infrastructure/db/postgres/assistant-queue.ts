import type { Prisma } from '@/generated/prisma/client';
import type { InteractionRepository } from 'interaction-builder/runtime';
import { checkUserConcurrency, reserveModelTurnBudget } from '@/src/server/domain/cohort-builder/budget-policy';

/** Host repository consumes this additional fence inside the append transaction. */
export function bindAssistantLease(repo: InteractionRepository, runId: string, leaseToken: string): InteractionRepository {
  return { ...repo, appendMessage: input => {
    const fenced = { ...input, runId, runLeaseToken: leaseToken };
    return repo.appendMessage(fenced);
  } };
}

/** Caller holds workspace lock. Messages remain pending until a lane is available. */
export async function admitPendingAssistantMessage(tx: Prisma.TransactionClient, workspaceId: string) {
  const active = await tx.interactionRun.findFirst({ where: { workspaceId, status: { in: ['queued', 'running'] } } });
  if (active) return active;
  const messages = await tx.$queryRaw<Array<{ id: string; sequence: number }>>`
    SELECT m.id, m.sequence FROM interaction_messages m
    WHERE m."workspaceId"=${workspaceId} AND m.role='user'
      AND NOT EXISTS (SELECT 1 FROM interaction_runs r WHERE r."workspaceId"=m."workspaceId" AND r."triggeringMessageId"=m.id)
    ORDER BY m.sequence LIMIT 1`;
  if (!messages[0]) return null;
  const ws = await tx.interactionWorkspace.findUnique({ where: { id: workspaceId } });
  if (!ws || ws.lifecycle !== 'active') return null;

  await checkUserConcurrency(tx, { userId: ws.ownerId });
  const runId = crypto.randomUUID();
  const reservation = await reserveModelTurnBudget(tx, { userId: ws.ownerId, workspaceId, runId });

  const run = await tx.interactionRun.create({ data: { id: runId, workspaceId,
    triggeringMessageId: messages[0].id, status: 'queued', contextEpoch: ws.contextEpoch,
    observedRevision: ws.revision, cursor: messages[0].sequence, fence: 0,
    budgetReservation: reservation as never } });
  await tx.interactionOutbox.create({ data: { id: crypto.randomUUID(), workspaceId, kind: 'assistant_run',
    payload: { runId: run.id, workspaceId }, dedupKey: `run:${run.id}`, status: 'pending', attempts: 0, dueAt: new Date() } });
  const sequence = ws.sequence + 1;
  await tx.interactionWorkspace.update({ where: { id: workspaceId }, data: { sequence } });
  await tx.interactionEvent.create({ data: { id: crypto.randomUUID(), workspaceId, sequence,
    protocolVersion: 1, type: 'run.changed', revision: null,
    payload: { run: { id: run.id, workspaceId, triggeringMessageId: run.triggeringMessageId, status: run.status } } } });
  return run;
}
