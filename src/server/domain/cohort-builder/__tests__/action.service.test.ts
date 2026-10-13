import { describe, expect, it } from 'vitest';
import { planActionCommit } from 'interaction-builder/runtime';
import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

const workspaceId = '00000000-0000-4000-8000-000000000001';
const actionId = '00000000-0000-4000-8000-000000000002';
const base = (): CohortWorkspace => cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Draft', intent: 'Learn TypeScript', audience: 'Beginner', dailyMinutes: 20, lessons: [] });

describe('interaction action commit boundary', () => {
  it('returns new revision and receipt from typed domain plan', () => {
    const result = planActionCommit({
      state: base(), currentRevision: 0,
      envelope: { actionId, workspaceId, expectedRevision: 0, entityVersions: [], action: { type: 'set_intent', intent: 'Learn Zod' } },
      plan: planCohortAction,
    });
    expect(result.revision).toBe(1);
    expect(result.state.intent).toBe('Learn Zod');
    expect(result.receipt).toMatchObject({ actionId, revision: 1, undoable: true });
  });
  it('rejects stale workspace before domain planning', () => {
    expect(() => planActionCommit({
      state: base(), currentRevision: 2,
      envelope: { actionId, workspaceId, expectedRevision: 1, entityVersions: [], action: { type: 'set_intent', intent: 'No' } },
      plan: planCohortAction,
    })).toThrow('STALE_WORKSPACE');
  });
});
