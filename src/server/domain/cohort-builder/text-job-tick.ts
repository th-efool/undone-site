import { putTextArtifact, type CohortTextArtifactKind, type TextArtifactSql } from './text-artifacts';
import { acceptTextJob, claimTextJob, failTextJob, type ClaimedTextJob } from './text-jobs';

const artifactKind: Record<string, CohortTextArtifactKind> = {
  acquisition: 'source_raw', understanding: 'understanding', chunking: 'chunks',
  analysis: 'analysis', assembly: 'assembly',
};

export type TextJobTickResult = { status: 'idle' | 'accepted' | 'failed' | 'stale'; jobId?: string };

/** Prepared host orchestration; callers own the deterministic stage processor and SQL connection. */
export async function runTextJobTick(input: {
  sql: TextArtifactSql;
  workerId: string;
  leaseMs: number;
  now: () => Date;
  process: (job: ClaimedTextJob) => Promise<Uint8Array>;
}): Promise<TextJobTickResult> {
  const job = await claimTextJob(input.sql, input.workerId, input.now(), input.leaseMs);
  if (!job) return { status: 'idle' };
  try {
    const kind = artifactKind[job.stage];
    if (!kind) throw new Error('INVALID_JOB_STAGE');
    const bytes = await input.process(job);
    const artifact = await putTextArtifact(input.sql, {
      workspaceId: job.workspaceId,
      ...(job.sourceId === null ? {} : { sourceId: job.sourceId, sourceVersion: job.sourceVersion! }),
      kind, inputFingerprint: job.dependencyFingerprint, bytes,
    });
    const accepted = await acceptTextJob(input.sql, job, artifact, input.now());
    return { status: accepted ? 'accepted' : 'stale', jobId: job.id };
  } catch (error) {
    const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'PROCESSOR_FAILURE';
    const failed = await failTextJob(input.sql, job, code, input.now());
    return { status: failed ? 'failed' : 'stale', jobId: job.id };
  }
}
