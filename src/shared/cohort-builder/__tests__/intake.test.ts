// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { cohortIntakeEnabled, cohortIntakeSchema } from '../intake';
import { cohortWorkspaceSchema, planCohortAction } from '../contracts';
import { readIntakeDraft, saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';
const body = { requestId: '54103d7b-2709-4dd6-bb18-522f96b97241', prompt: 'Learn consensus', source: { label: 'Notes', text: '  quorum\n' } };
beforeEach(() => sessionStorage.clear());
it('gates new intake by server enablement and optional owner allowlist', () => {
  expect(cohortIntakeEnabled('a', {})).toBe(false);
  expect(cohortIntakeEnabled('a', { INTERACTION_COHORT_V2_ENABLED: '1', INTERACTION_COHORT_V2_OWNERS: 'b' })).toBe(false);
  expect(cohortIntakeEnabled('a', { INTERACTION_COHORT_V2_ENABLED: '1', INTERACTION_COHORT_V2_OWNERS: 'a,b' })).toBe(true);
});
it('retains exact source and stable request identity through authentication confirmation', () => {
  saveIntakeDraft(body, null);
  expect(readIntakeDraft('a')).toEqual(body);
  saveIntakeDraft(body, 'a');
  expect(readIntakeDraft('a')).toEqual(body);
  expect(readIntakeDraft('b')).toBeNull();
  expect(readIntakeDraft('a')).toBeNull();
});
it('rejects malformed/oversized intake', () => {
  expect(cohortIntakeSchema.safeParse({ ...body, prompt: 'x'.repeat(4001) }).success).toBe(false);
  expect(cohortIntakeSchema.safeParse({ ...body, source: { label: 'Notes', text: ' ' } }).success).toBe(false);
});
it('keeps duplicate landing submissions on one pending request identity', () => {
  saveIntakeDraft(body, null);
  saveIntakeDraft({ ...body, requestId: '161a7dd4-5acf-4463-a66a-c3c2325d4be0' }, null);
  expect(readIntakeDraft('owner')?.requestId).toBe(body.requestId);
});
it('rejects a source editor based on an older source version', () => {
  const state = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Test', intent: 'Learn', audience: '', dailyMinutes: 20, lessons: [],
    sources: [{ id: 'source', version: 1, label: 'New', text: 'New source', checksum: null, state: 'queued' }] });
  expect(() => planCohortAction(state, { type: 'edit_text_source', sourceId: 'source', label: 'Old', text: 'Attempted edit' }, {
    actionId: body.requestId, workspaceId: body.requestId, expectedRevision: 2, currentRevision: 2, entityVersions: new Map([['source', 0]]),
  })).toThrow('STALE_ENTITY');
});
