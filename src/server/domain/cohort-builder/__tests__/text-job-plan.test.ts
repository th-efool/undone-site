import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { planTextJobs } from '../text-job-plan';

function state(): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1, title: 'Systems', intent: 'Learn distributed systems', audience: 'Engineers', dailyMinutes: 25,
    lessons: [],
    sources: [
      { id: 'source-a', version: 0, label: 'A', text: 'Quorums overlap.', checksum: null, state: 'queued' },
      { id: 'source-b', version: 0, label: 'B', text: 'Logs retain writes.', checksum: null, state: 'queued' },
    ],
  });
}

const keys = (workspace: CohortWorkspace, sourceId: string | null) => planTextJobs(workspace).filter(job => job.sourceId === sourceId).map(job => job.jobKey);

describe('cohort text job dependency planning', () => {
  it('does not change the graph when intermediate display data is projected', () => {
    const before = state();
    const projected = { ...before, title: 'Distributed Systems', description: 'A generated summary',
      understanding: [{ sourceId: 'source-a', sourceVersion: 0, topics: ['Quorums'] }] };
    expect(planTextJobs(projected)).toEqual(planTextJobs(before));
  });

  it('is stable and orders each source chain before global assembly', () => {
    const original = state();
    const jobs = planTextJobs(original);
    expect(jobs).toHaveLength(9);
    expect(jobs.filter(job => job.sourceId === 'source-a').map(job => job.stage)).toEqual(['acquisition', 'understanding', 'chunking', 'analysis']);
    expect(jobs.at(-1)?.prerequisiteKeys).toEqual(jobs.filter(job => job.stage === 'analysis').map(job => job.jobKey));
    expect(planTextJobs({ ...original, sources: [...original.sources].reverse() })).toEqual(jobs);
  });

  it('changes only one source chain and global assembly after a source edit', () => {
    const before = state();
    const after = structuredClone(before);
    after.sources[0].version += 1;
    after.sources[0].text = 'Quorums overlap and tolerate faults.';
    expect(keys(after, 'source-a')).not.toEqual(keys(before, 'source-a'));
    expect(keys(after, 'source-b')).toEqual(keys(before, 'source-b'));
    expect(keys(after, null)).not.toEqual(keys(before, null));
  });

  it('does not reacquire text for goal, audience, pacing, or authored edits', () => {
    const before = state();
    const goal = { ...before, intent: 'Learn consensus' };
    expect(planTextJobs(goal).slice(0, -1)).toEqual(planTextJobs(before).slice(0, -1));
    expect(keys(goal, null)).not.toEqual(keys(before, null));

    const audience = { ...before, audience: 'Beginners' };
    for (const sourceId of ['source-a', 'source-b']) {
      expect(keys(audience, sourceId).slice(0, 3)).toEqual(keys(before, sourceId).slice(0, 3));
      expect(keys(audience, sourceId)[3]).not.toBe(keys(before, sourceId)[3]);
    }

    const pacing = { ...before, dailyMinutes: 10 };
    expect(planTextJobs(pacing).slice(0, -1)).toEqual(planTextJobs(before).slice(0, -1));
    expect(keys(pacing, null)).not.toEqual(keys(before, null));

    const pinned = cohortWorkspaceSchema.parse({ ...before, lessons: [{ id: 'manual-1', version: 1, title: 'Keep', objective: 'My target', sourceChunkIds: [], pinned: true }] });
    expect(planTextJobs(pinned).slice(0, -1)).toEqual(planTextJobs(before).slice(0, -1));
    expect(keys(pinned, null)).not.toEqual(keys(before, null));
  });
});
