import { putTextArtifact, type CohortTextArtifactKind, type TextArtifactRef, type TextArtifactSql } from './text-artifacts';
import { claimTextJob, failTextJob, heartbeatTextJob, type ClaimedTextJob } from './text-jobs';

const artifactKind: Record<string, CohortTextArtifactKind> = {
  acquisition: 'source_raw', extraction: 'extraction', understanding: 'understanding', chunking: 'chunks',
  analysis: 'analysis', assembly: 'assembly', recommendations: 'recommendations', discovery: 'discovery',
};

export type TextJobTickResult = { status: 'idle' | 'accepted' | 'failed' | 'stale'; jobId?: string };

/** Host orchestration; callers own the stage processor and SQL connection. */
export async function runTextJobTick(input: {
  sql: TextArtifactSql;
  workerId: string;
  leaseMs: number;
  now: () => Date;
  process: (job: ClaimedTextJob) => Promise<Uint8Array>;
  accept: (job: ClaimedTextJob, artifact: TextArtifactRef, now: Date) => Promise<boolean>;
  renewLease?: boolean;
  fail?: (job: ClaimedTextJob, code: string, now: Date) => Promise<boolean>;
  processTimeoutMs?: number;
}): Promise<TextJobTickResult> {
  const processTimeoutMs = input.processTimeoutMs ?? 45_000;
  if (!Number.isSafeInteger(processTimeoutMs) || processTimeoutMs < 1 || processTimeoutMs > 300_000) throw new Error('INVALID_PROCESS_DEADLINE');
  const job = await claimTextJob(input.sql, input.workerId, input.now(), input.leaseMs);
  if (!job) return { status: 'idle' };
  let lostLease = false;
  let renewing: Promise<void> | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const timer = input.renewLease ? setInterval(() => {
    if (renewing) return;
    renewing = heartbeatTextJob(input.sql, job, input.now(), input.leaseMs)
      .then(ok => { if (!ok) lostLease = true; }, () => { lostLease = true; })
      .finally(() => { renewing = null; });
  }, Math.max(250, Math.floor(input.leaseMs / 3))) : null;
  try {
    const kind = artifactKind[job.stage];
    if (!kind) throw new Error('INVALID_JOB_STAGE');
    const bytes = await Promise.race([input.process(job), new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => reject(new Error('PROCESSOR_DEADLINE')), processTimeoutMs);
    })]);
    if (deadline) clearTimeout(deadline);
    if (lostLease) return { status: 'stale', jobId: job.id };
    const artifact = await putTextArtifact(input.sql, {
      workspaceId: job.workspaceId,
      ...(job.sourceId === null ? {} : { sourceId: job.sourceId, sourceVersion: job.sourceVersion! }),
      kind, inputFingerprint: job.dependencyFingerprint, bytes,
    });
    const accepted = await input.accept(job, artifact, input.now());
    return { status: accepted ? 'accepted' : 'stale', jobId: job.id };
  } catch (error) {
    const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'PROCESSOR_FAILURE';
    const failed = await (input.fail ?? ((claimed, errorCode, at) => failTextJob(input.sql, claimed, errorCode, at)))(job, code, input.now());
    return { status: failed ? 'failed' : 'stale', jobId: job.id };
  } finally {
    if (timer) clearInterval(timer);
    if (deadline) clearTimeout(deadline);
    if (renewing) await renewing;
  }
}
