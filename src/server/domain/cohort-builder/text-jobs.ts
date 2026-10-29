import { randomUUID } from 'node:crypto';
import { readTextArtifact, type CohortTextArtifactKind, type TextArtifactSql } from './text-artifacts';

const stageArtifactKind: Record<string, CohortTextArtifactKind> = {
  acquisition: 'source_raw', extraction: 'extraction', understanding: 'understanding', chunking: 'chunks',
  analysis: 'analysis', assembly: 'assembly', recommendations: 'recommendations', discovery: 'discovery',
};

export interface ClaimedTextJob {
  id: string;
  workspaceId: string;
  stage: string;
  sourceId: string | null;
  sourceVersion: number | null;
  dependencyFingerprint: string;
  fence: number;
  leaseToken: string;
  leaseUntil: Date;
  attempts?: number;
}

const leaseBounds = (now: Date, leaseMs: number) => {
  if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 300_000) throw new Error('INVALID_JOB_LEASE');
  return { at: now.toISOString(), until: new Date(now.getTime() + leaseMs).toISOString() };
};

/** One SQL statement claims a ready node; dependency edges remain authoritative. */
export async function claimTextJob(sql: TextArtifactSql, workerId: string, now: Date, leaseMs: number): Promise<ClaimedTextJob | null> {
  if (!workerId.trim()) throw new Error('INVALID_WORKER_ID');
  const time = leaseBounds(now, leaseMs);
  const token = randomUUID();
  await sql.query(`UPDATE "cohort_text_jobs"
    SET "status" = 'failed', "errorCode" = 'RETRY_EXHAUSTED',
        "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = $1::timestamp
    WHERE "status" = 'running' AND "leaseUntil" < $1::timestamp AND "attempts" >= 3`, [time.at]);
  const result = await sql.query(`WITH candidate AS (
    SELECT j."id" FROM "cohort_text_jobs" j
    WHERE j."handlerVersion" IN (1,2,3) AND j."attempts" < 3 AND ((j."status" = 'queued' AND j."dueAt" <= $1::timestamp)
      OR (j."status" = 'running' AND j."leaseUntil" < $1::timestamp))
      AND NOT EXISTS (
        SELECT 1 FROM "cohort_text_job_edges" e
        JOIN "cohort_text_jobs" prerequisite ON prerequisite."id" = e."prerequisiteId" AND prerequisite."workspaceId" = e."workspaceId"
        WHERE e."jobId" = j."id" AND e."workspaceId" = j."workspaceId" AND prerequisite."status" <> 'accepted'
      )
    ORDER BY j."dueAt", j."createdAt"
    FOR UPDATE OF j SKIP LOCKED LIMIT 1
  )
  UPDATE "cohort_text_jobs" j
  SET "status" = 'running', "leaseOwner" = $2, "leaseToken" = $3,
      "leaseUntil" = $4::timestamp, "fence" = j."fence" + 1,
      "attempts" = j."attempts" + 1, "updatedAt" = $1::timestamp
  FROM candidate WHERE j."id" = candidate."id"
  RETURNING j."id", j."workspaceId", j."stage", j."sourceId", j."sourceVersion",
    j."dependencyFingerprint", j."fence", j."leaseToken", j."leaseUntil"`,
  [time.at, workerId, token, time.until]);
  const row = result.rows[0];
  return row ? {
    id: String(row.id), workspaceId: String(row.workspaceId), stage: String(row.stage),
    sourceId: row.sourceId === null ? null : String(row.sourceId),
    sourceVersion: row.sourceVersion === null ? null : Number(row.sourceVersion),
    dependencyFingerprint: String(row.dependencyFingerprint), fence: Number(row.fence),
    leaseToken: String(row.leaseToken), leaseUntil: new Date(String(row.leaseUntil)),
  } : null;
}

export async function heartbeatTextJob(sql: TextArtifactSql, job: ClaimedTextJob, now: Date, leaseMs: number): Promise<boolean> {
  const time = leaseBounds(now, leaseMs);
  const result = await sql.query(`UPDATE "cohort_text_jobs"
    SET "leaseUntil" = $1::timestamp, "updatedAt" = $2::timestamp
    WHERE "id" = $3 AND "workspaceId" = $4 AND "status" = 'running'
      AND "leaseToken" = $5 AND "fence" = $6 AND "leaseUntil" > $2::timestamp
    RETURNING "id"`, [time.until, time.at, job.id, job.workspaceId, job.leaseToken, job.fence]);
  return result.rows.length === 1;
}

/** Verify retained bytes, then atomically recheck ownership, lease, and dependencies in SQL. */
export async function acceptTextJob(sql: TextArtifactSql, job: ClaimedTextJob, artifact: {
  id: string; workspaceId: string; kind: string; inputFingerprint: string; checksum: string;
}, now: Date): Promise<boolean> {
  if (artifact.workspaceId !== job.workspaceId || artifact.inputFingerprint !== job.dependencyFingerprint || artifact.kind !== stageArtifactKind[job.stage]) return false;
  await readTextArtifact(sql, job.workspaceId, artifact.id, {
    kind: artifact.kind as CohortTextArtifactKind, inputFingerprint: artifact.inputFingerprint, checksum: artifact.checksum,
  });
  const result = await sql.query(`UPDATE "cohort_text_jobs" j
    SET "status" = 'accepted', "resultArtifactId" = $1,
        "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = $2::timestamp
    WHERE j."id" = $3 AND j."workspaceId" = $4 AND j."status" = 'running'
      AND j."leaseToken" = $5 AND j."fence" = $6 AND j."leaseUntil" > $2::timestamp
      AND j."dependencyFingerprint" = $7
      AND EXISTS (SELECT 1 FROM "cohort_text_artifacts" a
        WHERE a."id" = $1 AND a."workspaceId" = j."workspaceId"
          AND a."kind" = $8 AND a."inputFingerprint" = $7 AND a."checksum" = $9
          AND a."sourceId" IS NOT DISTINCT FROM j."sourceId"
          AND a."sourceVersion" IS NOT DISTINCT FROM j."sourceVersion"
          AND a."byteLength" = octet_length(a."body"))
      AND NOT EXISTS (SELECT 1 FROM "cohort_text_job_edges" e
        JOIN "cohort_text_jobs" prerequisite ON prerequisite."id" = e."prerequisiteId" AND prerequisite."workspaceId" = e."workspaceId"
        WHERE e."jobId" = j."id" AND e."workspaceId" = j."workspaceId" AND prerequisite."status" <> 'accepted')
    RETURNING j."id"`,
  [artifact.id, now.toISOString(), job.id, job.workspaceId, job.leaseToken, job.fence,
    job.dependencyFingerprint, artifact.kind, artifact.checksum]);
  return result.rows.length === 1;
}

export async function failTextJob(sql: TextArtifactSql, job: ClaimedTextJob, errorCode: string, now: Date): Promise<boolean> {
  if (!Number.isFinite(now.getTime())) throw new Error('INVALID_FAILURE_TIME');
  const isTransient = errorCode === 'RATE_LIMITED' || errorCode === 'AI_UNAVAILABLE' || errorCode === 'VIDEO_OBSERVATION_DEADLINE';
  if (isTransient && (job.attempts ?? 0) < 5) {
    const delayMs = Math.min(1_000 * Math.max(1, job.attempts ?? 1), 5_000);
    const dueAt = new Date(now.getTime() + delayMs);
    const result = await sql.query(`UPDATE "cohort_text_jobs"
      SET "status" = 'queued', "dueAt" = $1::timestamp, "errorCode" = $2,
          "attempts" = "attempts" + 1, "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL,
          "updatedAt" = $6::timestamp
      WHERE "id" = $3 AND "workspaceId" = $4 AND "status" = 'running'
        AND "leaseToken" = $5 AND "fence" = $7 AND "leaseUntil" > $6::timestamp RETURNING "id"`,
      [dueAt.toISOString(), errorCode.slice(0, 100), job.id, job.workspaceId, job.leaseToken, now.toISOString(), job.fence]);
    return result.rows.length === 1;
  }
  const result = await sql.query(`UPDATE "cohort_text_jobs"
    SET "status" = 'failed', "errorCode" = $1, "leaseOwner" = NULL,
        "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = $6::timestamp
    WHERE "id" = $2 AND "workspaceId" = $3 AND "status" = 'running'
      AND "leaseToken" = $4 AND "fence" = $5 AND "leaseUntil" > $6::timestamp RETURNING "id"`,
  [errorCode.slice(0, 100), job.id, job.workspaceId, job.leaseToken, job.fence, now.toISOString()]);
  return result.rows.length === 1;
}

export async function retryTextJob(sql: TextArtifactSql, workspaceId: string, jobId: string, now: Date): Promise<boolean> {
  if (!Number.isFinite(now.getTime())) throw new Error('INVALID_RETRY_TIME');
  const result = await sql.query(`UPDATE "cohort_text_jobs"
    SET "status" = 'queued', "dueAt" = $1::timestamp, "errorCode" = NULL, "updatedAt" = $1::timestamp
    WHERE "workspaceId" = $2 AND "id" = $3 AND "status" = 'failed' AND "attempts" < 3
    RETURNING "id"`, [now.toISOString(), workspaceId, jobId]);
  return result.rows.length === 1;
}

/** Source version changes revoke all unaccepted jobs for the superseded version. */
export async function supersedeTextSourceJobs(sql: TextArtifactSql, workspaceId: string, sourceId: string, currentVersion: number): Promise<number> {
  const result = await sql.query(`UPDATE "cohort_text_jobs"
    SET "status" = 'superseded', "fence" = "fence" + 1,
        "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "workspaceId" = $1 AND "sourceId" = $2 AND "sourceVersion" < $3
      AND "status" IN ('queued', 'running', 'failed') RETURNING "id"`,
  [workspaceId, sourceId, currentVersion]);
  return result.rows.length;
}
