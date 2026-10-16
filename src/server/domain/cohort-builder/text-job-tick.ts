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
  process: (job: ClaimedTextJob, signal?: AbortSignal) => Promise<Uint8Array>;
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

  const abortController = new AbortController();

  const timer = input.renewLease ? setInterval(() => {
    if (renewing) return;
    renewing = heartbeatTextJob(input.sql, job, input.now(), input.leaseMs)
      .then(ok => {
        if (!ok) {
          lostLease = true;
          abortController.abort(new Error('LEASE_LOST'));
        }
      }, () => {
        lostLease = true;
        abortController.abort(new Error('LEASE_LOST'));
      })
      .finally(() => { renewing = null; });
  }, Math.max(250, Math.floor(input.leaseMs / 3))) : null;

  try {
    const kind = artifactKind[job.stage];
    if (!kind) throw new Error('INVALID_JOB_STAGE');

    deadline = setTimeout(() => {
      abortController.abort(new Error('PROCESSOR_DEADLINE'));
    }, processTimeoutMs);

    const bytes = await Promise.race([
      input.process(job, abortController.signal),
      new Promise<never>((_resolve, reject) => {
        if (abortController.signal.aborted) {
          const reason = abortController.signal.reason;
          reject(reason instanceof Error ? reason : new Error('PROCESSOR_DEADLINE'));
        } else {
          abortController.signal.addEventListener('abort', () => {
            const reason = abortController.signal.reason;
            reject(reason instanceof Error ? reason : new Error('PROCESSOR_DEADLINE'));
          }, { once: true });
        }
      }),
    ]);

    if (deadline) clearTimeout(deadline);
    if (lostLease || abortController.signal.aborted) return { status: 'stale', jobId: job.id };
    const artifact = await putTextArtifact(input.sql, {
      workspaceId: job.workspaceId,
      ...(job.sourceId === null ? {} : { sourceId: job.sourceId, sourceVersion: job.sourceVersion! }),
      kind, inputFingerprint: job.dependencyFingerprint, bytes,
    });
    const accepted = await input.accept(job, artifact, input.now());
    return { status: accepted ? 'accepted' : 'stale', jobId: job.id };
  } catch (error) {
    if (lostLease || (error instanceof Error && error.message === 'LEASE_LOST')) {
      return { status: 'stale', jobId: job.id };
    }
    const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'PROCESSOR_FAILURE';
    const failed = await (input.fail ?? ((claimed, errorCode, at) => failTextJob(input.sql, claimed, errorCode, at)))(job, code, input.now());
    return { status: failed ? 'failed' : 'stale', jobId: job.id };
  } finally {
    if (timer) clearInterval(timer);
    if (deadline) clearTimeout(deadline);
    if (renewing) await renewing;
  }
}
