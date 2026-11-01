// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { cohortIntakeEnabled, cohortIntakeSchema, initialCohort } from '../intake';
import { cohortWorkspaceSchema, planCohortAction, CohortSource } from '../contracts';
import { planJourneyJobs } from '@/src/server/domain/cohort-builder/journey-job-plan';
import { readIntakeDraft, saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';

const body = { requestId: '54103d7b-2709-4dd6-bb18-522f96b97241', prompt: 'Learn consensus', mode: 'search' as const, source: { label: 'Notes', text: '  quorum\n' } };

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

it('supports mode: plan and mode: search in cohortIntakeSchema', () => {
  const parsedPlan = cohortIntakeSchema.parse({ ...body, mode: 'plan' });
  expect(parsedPlan.mode).toBe('plan');

  const parsedDefault = cohortIntakeSchema.parse(body);
  expect(parsedDefault.mode).toBe('search');
});

it('initializes step=chat when mode is plan and step=recommendations when mode is search', () => {
  const planCohort = initialCohort('Learn Machine Learning', { mode: 'plan' });
  expect(planCohort.journey?.step).toBe('chat');

  const searchCohort = initialCohort('Learn Machine Learning', { mode: 'search' });
  expect(searchCohort.journey?.step).toBe('recommendations');
});

it('initializes initial sources into workspace', () => {
  const sampleSource: CohortSource = {
    id: 'src-1',
    version: 1,
    label: 'Doc 1',
    text: 'Source content text',
    checksum: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    state: 'ready',
  };
  const ws = initialCohort('Learn Rust', { mode: 'plan', sources: [sampleSource] });
  expect(ws.sources.length).toBe(1);
  expect(ws.sources[0].id).toBe('src-1');
  expect(ws.sources[0].text).toBe('Source content text');
});

it('planJourneyJobs does NOT queue phantom recommendations jobs when step is chat', () => {
  const ws = initialCohort('Learn Rust', { mode: 'plan' });
  expect(ws.journey?.step).toBe('chat');
  const jobs = planJourneyJobs(ws);
  expect(jobs.filter(j => j.stage === 'recommendations').length).toBe(0);
});

it('planJourneyJobs DOES queue recommendations job when step is recommendations', () => {
  const ws = initialCohort('Learn Rust', { mode: 'search' });
  expect(ws.journey?.step).toBe('recommendations');
  const jobs = planJourneyJobs(ws);
  expect(jobs.filter(j => j.stage === 'recommendations').length).toBe(1);
});

it('preserves supplied requestId without rewriting it to match prior draft', () => {
  saveIntakeDraft(body, null);
  saveIntakeDraft({ ...body, requestId: '161a7dd4-5acf-4463-a66a-c3c2325d4be0' }, null);
  expect(readIntakeDraft('owner')?.requestId).toBe('161a7dd4-5acf-4463-a66a-c3c2325d4be0');
});

it('rejects a source editor based on an older source version', () => {
  const state = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Test', intent: 'Learn', audience: '', dailyMinutes: 20, lessons: [],
    sources: [{ id: 'source', version: 1, label: 'New', text: 'New source', checksum: null, state: 'queued' }] });
  expect(() => planCohortAction(state, { type: 'edit_text_source', sourceId: 'source', label: 'Old', text: 'Attempted edit' }, {
    actionId: body.requestId, workspaceId: body.requestId, expectedRevision: 2, currentRevision: 2, entityVersions: new Map([['source', 0]]),
  })).toThrow('STALE_ENTITY');
});

it('preserves metadata-only sources when sessionStorage quota requires text stripping', () => {
  const sourcesPayload: CohortSource[] = [
    {
      id: 'src-meta',
      version: 1,
      label: 'https://example.com/guide',
      text: 'Long extracted text body',
      state: 'ready',
      checksum: 'a'.repeat(64),
      input: { kind: 'web', url: 'https://example.com/guide' },
    },
  ];
  const intakeWithSources = {
    ...body,
    requestId: '22222222-2222-4222-8222-222222222222',
    sources: sourcesPayload,
  };

  // Mock Storage.prototype.setItem to fail first setItem (simulating full body quota fail)
  let calls = 0;
  const original = Storage.prototype.setItem;
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, val: string) {
    calls++;
    if (calls === 1) {
      throw new Error('QuotaExceededError');
    }
    return original.call(this, key, val);
  });

  try {
    saveIntakeDraft(intakeWithSources, null);
    const restored = readIntakeDraft('owner');
    expect(restored).not.toBeNull();
    expect(restored?.sources).toHaveLength(1);
    expect(restored?.sources?.[0].label).toBe('https://example.com/guide');
    expect(restored?.sources?.[0].text).toBe(''); // empty text restored cleanly
    expect(restored?.sources?.[0].input).toEqual({ kind: 'web', url: 'https://example.com/guide' });
  } finally {
    spy.mockRestore();
  }
});

it('supports 100-source intake without truncation', () => {
  const hundredSources: CohortSource[] = Array.from({ length: 100 }, (_, i) => ({
    id: `src-${i}`,
    version: 1,
    label: `Source ${i}`,
    text: `Content ${i}`,
    checksum: 'b'.repeat(64),
    state: 'ready',
  }));
  const intake = cohortIntakeSchema.parse({
    requestId: '33333333-3333-4333-8333-333333333333',
    prompt: 'Learn distributed consensus',
    mode: 'plan',
    sources: hundredSources,
  });
  expect(intake.sources).toHaveLength(100);
});
