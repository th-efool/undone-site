// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { cohortIntakeEnabled, cohortIntakeSchema } from '../intake';
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
