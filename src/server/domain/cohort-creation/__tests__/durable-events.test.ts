import { describe, expect, it, vi } from 'vitest';
import { creationEventsHandler } from '../durable-job.events';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { CreationEventRepository } from '../durable-job';

const state = initialSnapshot(draftId);
const envelope = (sequence: number) => ({ schemaVersion: 1 as const, draftId, jobId: null, inputRevision: 0,
  sequence, kind: 'snapshot' as const, snapshot: state, job: null, createdAt: new Date().toISOString() });
const request = (after = '0') => new Request(`http://localhost/api/events?after=${after}`);
describe('owned NDJSON replay', () => {
  it('authorizes before reading and rejects foreign drafts without exposing events', async () => {
    const repo: CreationEventRepository = { read: vi.fn(async () => null) };
    expect((await creationEventsHandler(repo, async () => null)(request(), draftId)).status).toBe(401);
    expect(repo.read).not.toHaveBeenCalled();
    expect((await creationEventsHandler(repo, async () => 'foreign')(request(), draftId)).status).toBe(404);
    expect(repo.read).toHaveBeenCalledWith('foreign', draftId, 0);
  });
  it('returns a canonical reset snapshot for expired history', async () => {
    const repo: CreationEventRepository = { read: vi.fn(async () => ({ snapshot: state, cursor: 42, jobs: [], reset: true, events: [] })) };
    const response = await creationEventsHandler(repo, async () => 'owner', { durationMs: 0, intervalMs: 1 })(request('1'), draftId);
    expect(response.headers.get('Content-Type')).toContain('application/x-ndjson');
    const lines = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    expect(lines[0]).toMatchObject({ kind: 'snapshot', sequence: 42, draftId });
    expect(lines[1]).toEqual({ kind: 'heartbeat', cursor: 42 });
  });
  it('replays only unseen events and advertises the delivered cursor', async () => {
    const repo: CreationEventRepository = { read: vi.fn(async () => ({ snapshot: state, cursor: 9, jobs: [], reset: false, events: [envelope(3), envelope(4)] })) };
    const response = await creationEventsHandler(repo, async () => 'owner', { durationMs: 0, intervalMs: 1 })(request('2'), draftId);
    const lines = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    expect(lines.map(line => line.sequence ?? line.cursor)).toEqual([3, 4, 4]);
  });
  it('rejects malformed and unsafe cursors', async () => {
    const repo: CreationEventRepository = { read: vi.fn() };
    for (const cursor of ['-1', 'Infinity', '9007199254740992', '1.5']) {
      expect((await creationEventsHandler(repo, async () => 'owner')(request(cursor), draftId)).status).toBe(400);
    }
    expect(repo.read).not.toHaveBeenCalled();
  });
});
