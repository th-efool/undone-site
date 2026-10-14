import { cohortTextJobViewSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from './text-artifacts';
import { planTextJobs } from './text-job-plan';

/** Current graph only: bounded, no source bodies, no lease tokens or historical jobs. */
export async function textJobStatus(tx: TextArtifactSql, workspaceId: string, state: CohortWorkspace): Promise<CohortWorkspace> {
  const keys = planTextJobs(state).map(item => item.jobKey);
  const rows = await tx.query(`SELECT "id", "sourceId", "stage", "status", "attempts", "errorCode"
    FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" = ANY($2::text[])
    ORDER BY "createdAt", "id" LIMIT 81`, [workspaceId, keys]);
  const jobs = rows.rows.map(row => cohortTextJobViewSchema.parse({ id: row.id, sourceId: row.sourceId, stage: row.stage,
    status: row.status, attempts: Number(row.attempts), error: row.errorCode,
    retryable: row.status === 'failed' && Number(row.attempts) < 3,
  }));
  const failed = jobs.find(job => job.status === 'failed');
  const canceled = jobs.some(job => job.status === 'canceled');
  const done = jobs.length > 0 && jobs.length === keys.length && jobs.every(job => job.status === 'accepted');
  const pending = jobs.find(job => job.status !== 'accepted');
  return { ...state, sources: state.sources.map(source => {
    const own = jobs.filter(job => job.sourceId === source.id);
    const status = own.some(job => job.status === 'failed') ? 'failed'
      : own.length === 4 && own.every(job => job.status === 'accepted') ? 'ready'
      : own.some(job => job.status === 'running') ? 'processing' : 'queued';
    return { ...source, state: status };
  }), processing: { ...state.processing, jobs,
    status: failed ? 'failed' : canceled ? 'idle' : done ? 'ready' : jobs.length ? 'queued' : 'idle',
    stage: done || !keys.length ? 'done' : pending?.stage ?? 'assembly',
    error: failed?.error ?? (canceled ? 'PROCESSING_CANCELED' : null),
  } };
}
