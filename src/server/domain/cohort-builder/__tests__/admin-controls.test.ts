import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initAdminControlTables,
  getAdminControl,
  setAdminControl,
  isIntakeEnabled,
  setIntakeEnabled,
  areModelCallsPaused,
  setModelCallsPaused,
  isPublicReleaseSuspended,
  setPublicReleaseSuspended,
  isSourceCapabilityEnabled,
  setSourceCapabilityEnabled,
  cancelWorkItem,
  getAdminAuditLog,
  type AdminSql,
} from '../admin-controls';
import { createCohortAiTools } from '../tools';

describe('S6 Checkpoint 4: Administrative Controls & Audit Logging', () => {
  let controlsMap: Map<string, any>;
  let auditRows: Array<any>;
  let textJobs: Map<string, any>;
  let runs: Map<string, any>;

  let mockSql: AdminSql;

  beforeEach(() => {
    controlsMap = new Map();
    auditRows = [];
    textJobs = new Map();
    runs = new Map();

    mockSql = {
      query: vi.fn(async (stmt: string, params: unknown[] = []) => {
        // Init tables
        if (stmt.includes('CREATE TABLE IF NOT EXISTS')) {
          return { rows: [] };
        }

        // Fetch control
        if (stmt.includes('SELECT "value" FROM "cohort_admin_controls"')) {
          const key = params[0] as string;
          const found = controlsMap.get(key);
          return { rows: found !== undefined ? [{ value: found }] : [] };
        }

        // Upsert control
        if (stmt.includes('INSERT INTO "cohort_admin_controls"')) {
          const [key, valueStr] = [params[0] as string, params[1] as string];
          controlsMap.set(key, JSON.parse(valueStr));
          return { rows: [] };
        }

        // Insert audit row
        if (stmt.includes('INSERT INTO "cohort_admin_control_audit"')) {
          const [controlKey, oldValueStr, newValueStr, actorId, reason, createdAt] = [
            params[0] as string,
            params[1] as string | null,
            params[2] as string,
            params[3] as string,
            params[4] as string,
            params[5] as string,
          ];
          const id = auditRows.length + 1;
          const row = {
            id,
            control_key: controlKey,
            old_value: oldValueStr ? JSON.parse(oldValueStr) : null,
            new_value: JSON.parse(newValueStr),
            actor_id: actorId,
            reason,
            created_at: createdAt,
          };
          auditRows.push(row);
          return { rows: [row] };
        }

        // Cancel job
        if (stmt.includes('UPDATE "cohort_text_jobs"')) {
          const [updatedAt, error, jobId] = [params[0], params[1], params[2] as string];
          const job = textJobs.get(jobId);
          if (job && (job.status === 'queued' || job.status === 'running')) {
            job.status = 'failed';
            job.errorCode = 'ADMIN_CANCELED';
            job.updatedAt = updatedAt;
            job.error = error;
            return { rows: [{ id: jobId }] };
          }
          return { rows: [] };
        }

        // Cancel run
        if (stmt.includes('UPDATE "interaction_runs"')) {
          const [settledAt, runId] = [params[0], params[1] as string];
          const run = runs.get(runId);
          if (run && (run.status === 'pending' || run.status === 'running')) {
            run.status = 'failed';
            run.error = 'ADMIN_CANCELED';
            run.settledAt = settledAt;
            run.budgetActual = { status: 'unknown_outcome_retained' };
            return { rows: [{ id: runId }] };
          }
          return { rows: [] };
        }

        // Audit log query
        if (stmt.includes('FROM "cohort_admin_control_audit"')) {
          return { rows: [...auditRows].reverse() };
        }

        return { rows: [] };
      }),
    };
  });

  it('provides safe defaults when no administrative overrides exist', async () => {
    await initAdminControlTables(mockSql);

    expect(await isIntakeEnabled(mockSql)).toBe(true);
    expect(await areModelCallsPaused(mockSql)).toBe(false);
    expect(await isPublicReleaseSuspended(mockSql)).toBe(false);
    expect(await isSourceCapabilityEnabled(mockSql, 'pdf')).toBe(true);
    expect(await isSourceCapabilityEnabled(mockSql, 'web')).toBe(true);
    expect(await isSourceCapabilityEnabled(mockSql, 'youtube')).toBe(true);
    expect(await isSourceCapabilityEnabled(mockSql, 'github')).toBe(true);
  });

  it('updates controls and appends immutable audit records', async () => {
    await initAdminControlTables(mockSql);

    // 1. Operator disables intake
    await setIntakeEnabled(mockSql, {
      enabled: false,
      actorId: 'admin-alice',
      reason: 'Scheduled database maintenance window',
    });

    expect(await isIntakeEnabled(mockSql)).toBe(false);

    // 2. Operator pauses model calls
    await setModelCallsPaused(mockSql, {
      paused: true,
      actorId: 'admin-bob',
      reason: 'Upstream LLM provider degradation detected',
    });

    expect(await areModelCallsPaused(mockSql)).toBe(true);

    // 3. Operator toggles YouTube capability
    await setSourceCapabilityEnabled(mockSql, {
      capability: 'youtube',
      enabled: false,
      actorId: 'admin-alice',
      reason: 'OAuth quota exhausted',
    });

    expect(await isSourceCapabilityEnabled(mockSql, 'youtube')).toBe(false);

    // 4. Operator suspends public release
    await setPublicReleaseSuspended(mockSql, {
      suspended: true,
      actorId: 'admin-charlie',
      reason: 'Content moderation review in progress',
    });

    expect(await isPublicReleaseSuspended(mockSql)).toBe(true);

    // 5. Audit log reflects all mutations with actors and reasons
    const audit = await getAdminAuditLog(mockSql);
    expect(audit.length).toBe(4);

    expect(audit[0].controlKey).toBe('public_release_suspended');
    expect(audit[0].newValue).toBe(true);
    expect(audit[0].actorId).toBe('admin-charlie');

    expect(audit[1].controlKey).toBe('source_capability:youtube');
    expect(audit[1].newValue).toBe(false);
    expect(audit[1].actorId).toBe('admin-alice');

    expect(audit[2].controlKey).toBe('model_calls_paused');
    expect(audit[2].newValue).toBe(true);
    expect(audit[2].actorId).toBe('admin-bob');

    expect(audit[3].controlKey).toBe('intake_enabled');
    expect(audit[3].oldValue).toBe(null);
    expect(audit[3].newValue).toBe(false);
    expect(audit[3].actorId).toBe('admin-alice');
  });

  it('cancels specific in-flight job and run with conservative accounting', async () => {
    // 1. Seed active job and run
    textJobs.set('job-999', { id: 'job-999', status: 'running' });
    runs.set('run-888', { id: 'run-888', status: 'running' });

    // 2. Cancel job
    const jobRes = await cancelWorkItem(mockSql, {
      type: 'job',
      id: 'job-999',
      actorId: 'admin-ops',
      reason: 'Stuck processor detected on worker 3',
    });
    expect(jobRes.canceled).toBe(true);
    expect(textJobs.get('job-999').status).toBe('failed');
    expect(textJobs.get('job-999').errorCode).toBe('ADMIN_CANCELED');

    // 3. Cancel run
    const runRes = await cancelWorkItem(mockSql, {
      type: 'run',
      id: 'run-888',
      actorId: 'admin-ops',
      reason: 'Runaway token loop requested by user',
    });
    expect(runRes.canceled).toBe(true);
    expect(runs.get('run-888').status).toBe('failed');
    expect(runs.get('run-888').error).toBe('ADMIN_CANCELED');
    expect(runs.get('run-888').budgetActual.status).toBe('unknown_outcome_retained');

    // 4. Repeated cancel on already terminal item safely returns terminal_or_missing
    const repeatRes = await cancelWorkItem(mockSql, {
      type: 'job',
      id: 'job-999',
      actorId: 'admin-ops',
      reason: 'Repeated cancel',
    });
    expect(repeatRes.canceled).toBe(false);
    expect(repeatRes.previousStatus).toBe('terminal_or_missing');
  });

  it('strictly isolates administrative controls from model tools', () => {
    const mockRepo: any = {};
    const tools = createCohortAiTools({
      workspaceId: 'ws-test',
      ownerId: 'owner-test',
      repo: mockRepo,
      domain: {} as any,
    });

    const toolNames = Object.keys(tools);

    // Model tools must contain only cohort builder assistant tools
    expect(toolNames).toContain('add_web_source');
    expect(toolNames).toContain('add_pdf_source');
    expect(toolNames).toContain('cancel_source_processing');

    // Model tools MUST NOT contain administrative controls
    expect(toolNames).not.toContain('setIntakeEnabled');
    expect(toolNames).not.toContain('setModelCallsPaused');
    expect(toolNames).not.toContain('setPublicReleaseSuspended');
    expect(toolNames).not.toContain('cancelWorkItem');
    expect(toolNames).not.toContain('setSourceCapabilityEnabled');
    expect(toolNames).not.toContain('getAdminAuditLog');
  });
});
