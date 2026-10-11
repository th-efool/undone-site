import 'server-only';
import { start } from 'workflow/api';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { creationExecutionRepo } from './infrastructure/db/postgres/creationExecution.repo';
import { runDurableCreation } from './creation.workflow';
import { dispatchRecommendation } from './domain/cohort-creation/recommendation.runtime';

export async function dispatchCreationExecution(ownerId: string, snapshot: CreationSnapshot) {
  if (process.env.VERCEL !== '1') { dispatchRecommendation(ownerId, snapshot); return; }
  if (snapshot.status !== 'running' || !snapshot.activeRequestId) return;
  let reservation: Awaited<ReturnType<typeof creationExecutionRepo.reserve>> = null;
  try {
    const scope = { ownerId, draftId: snapshot.draftId, requestId: snapshot.activeRequestId };
    reservation = await creationExecutionRepo.reserve(scope);
    if (!reservation) return;
    const run = await start(runDurableCreation, [scope]);
    await creationExecutionRepo.confirm(reservation.jobId, reservation.token, run.runId);
  } catch {
    if (reservation) await creationExecutionRepo.release(reservation.jobId, reservation.token).catch(() => undefined);
    console.error('[creation-execution] Dispatch unavailable; saved work can be resumed.');
  }
}
