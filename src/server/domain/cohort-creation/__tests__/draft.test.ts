import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { DraftService } from '../draft.service';
import type { CreationJobRepository } from '../durable-job';
import { draftHandlers } from '../draft.http';
import { initialSnapshot, applyCommand, applyEvent } from '@/src/shared/cohort-creation/flow';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { safeReturnTo, creationSignInUrl } from '@/src/shared/auth/returnTo';
import type { DraftRepository } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';

function fixture() {
  const rows = new Map<string, { owner: string; state: CreationSnapshot }>();
  const repo: DraftRepository = {
    create: async (owner, id) => { if (!rows.has(id)) rows.set(id, { owner, state: initialSnapshot(id) }); return repo.load(owner, id); },
    load: async (owner, id) => rows.get(id)?.owner === owner ? structuredClone(rows.get(id)!.state) : null,
    swap: async (owner, id, revision, next) => {
      if (rows.get(id)?.owner !== owner || rows.get(id)?.state.revision !== revision) return false;
      rows.set(id, { owner, state: structuredClone(next) }); return true;
    },
  };
  const jobs: Pick<CreationJobRepository, 'enqueue' | 'cancel'> = {
    enqueue: vi.fn(async (owner, previous, next) => await repo.swap(owner, previous.draftId, previous.revision, next) ? next : null),
    cancel: vi.fn((owner, previous, next) => repo.swap(owner, previous.draftId, previous.revision, next)),
  };
  const service = new DraftService(repo, jobs);
  return { service, repo, jobs };
}
const request = (method: string, body?: unknown) => new Request('http://localhost/api/drafts', { method, ...(body ? { body: JSON.stringify(body) } : {}) });
describe('owned durable drafts', () => {
  it.each([
    ['Save a video selection before observing it', 400],
    ['The draft already has 100 selected units. Remove a source before adding GitHub files.', 400],
    ['The draft already has 100 selected units. Remove a source before adding a Notion page.', 400],
    ['Unexpected database failure', 503],
  ])('maps command failures safely: %s', async (message, status) => {
    const { service } = fixture();
    vi.spyOn(service, 'command').mockRejectedValue(new Error(message));
    const response = await draftHandlers(service, async () => 'alice')(request('PATCH', {
      baseRevision: 0, command: { type: 'create_own' },
    }), draftId);
    expect(response.status).toBe(status);
    expect((await response.json()).message).toBe(status === 400 ? message : 'Draft storage is unavailable. Try again.');
  });
  it('creates idempotently for the authenticated owner and rejects unauthenticated access', async () => {
    const { service } = fixture();
    const handler = draftHandlers(service, async () => 'alice');
    expect((await handler(request('POST', { draftId }))).status).toBe(201);
    expect((await handler(request('POST', { draftId }))).status).toBe(201);
    expect((await draftHandlers(service, async () => null)(request('GET'), draftId)).status).toBe(401);
  });
  it('does not reveal or overwrite another owner’s draft', async () => {
    const { service } = fixture(); await service.create('alice', draftId);
    const handler = draftHandlers(service, async () => 'bob');
    expect((await handler(request('GET'), draftId)).status).toBe(404);
    expect((await handler(request('POST', { draftId }))).status).toBe(404);
    expect((await handler(request('PATCH', { baseRevision: 0, command: { type: 'create_own' } }), draftId)).status).toBe(404);
    expect((await service.load('alice', draftId)).revision).toBe(0);
  });
  it('rejects invalid/nonexistent draft IDs and client-supplied owner/state', async () => {
    const { service } = fixture(); const handler = draftHandlers(service, async () => 'alice');
    expect((await handler(request('GET'), 'invalid')).status).toBe(404);
    expect((await handler(request('GET'), draftId)).status).toBe(404);
    expect((await handler(request('POST', { draftId, ownerId: 'bob' }))).status).toBe(400);
  });
  it('persists server recommendation results and resumes a starting point with a fresh service', async () => {
    const { service, repo, jobs } = fixture(); await service.create('alice', draftId);
    const queued = await service.command('alice', draftId, 0, { type: 'request_recommendations', requestId: result.requestId, query: result.intent.rawQuery });
    expect(queued.status).toBe('running');
    const generated = applyEvent(queued, { type: 'recommendations_received', result });
    await repo.swap('alice', draftId, queued.revision, generated);
    const own = await service.command('alice', draftId, generated.revision, { type: 'create_own' });
    await service.command('alice', draftId, own.revision, { type: 'choose_starting_point', startingPoint: 'have_goal' });
    const resumed = await new DraftService(repo, jobs).load('alice', draftId);
    expect(resumed).toMatchObject({ storage: 'postgres', stage: 'starting_point', startingPoint: 'have_goal', revision: 4 });
  });
  it('returns 409 canonical state and rejects competing updates at the same revision', async () => {
    const { service, repo } = fixture(); const state = await service.create('alice', draftId);
    const running = applyCommand(state, { type: 'request_recommendations', query: result.intent.rawQuery, requestId: result.requestId });
    await repo.swap('alice', draftId, 0, running);
    const response = await draftHandlers(service, async () => 'alice')(request('PATCH', { baseRevision: 0, command: { type: 'cancel_recommendations' } }), draftId);
    expect(response.status).toBe(409);
    expect((await response.json()).current.revision).toBe(1);
    const canceled = applyEvent(running, { type: 'operation_cancelled', requestId: result.requestId });
    expect(await repo.swap('alice', draftId, 1, canceled)).toBe(true);
    expect(await repo.swap('alice', draftId, 1, canceled)).toBe(false);
  });
  it('deduplicates a lost enqueue response and persists explicit cancellation', async () => {
    const { service, jobs } = fixture();
    await service.create('alice', draftId);
    const command = { type: 'request_recommendations' as const, requestId: result.requestId, query: result.intent.rawQuery };
    const queued = await service.command('alice', draftId, 0, command);
    expect(await service.command('alice', draftId, 0, command)).toEqual(queued);
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
    await service.command('alice', draftId, 1, { type: 'cancel_recommendations' });
    expect(jobs.cancel).toHaveBeenCalledOnce();
    expect((await service.load('alice', draftId)).status).toBe('canceled');
  });
  it('keeps auth destinations internal and preserves query/draft continuity', () => {
    for (const input of ['https://bad.test', '//bad.test', '/%2f%2fbad.test', '/\\bad', '/auth']) expect(safeReturnTo(input)).toBe('/home');
    expect(safeReturnTo(`/quest/draft/${draftId}`)).toBe(`/quest/draft/${draftId}`);
    expect(creationSignInUrl('/quest/new?q=Learn%20rendering')).toContain('returnTo=%2Fquest%2Fnew');
    expect(safeReturnTo(undefined)).toBe('/home');
  });
  it('returns actionable command errors for unavailable processing rather than storage failures', async () => {
    const { service } = fixture(); await service.create('alice', draftId);
    const handler = draftHandlers(service, async () => 'alice');
    for (const command of [{ type: 'understand_material', requestId: result.requestId }, { type: 'chunk_material', requestId: result.requestId }, { type: 'cancel_processing' }, { type: 'back_to_materials' }]) {
      const response = await handler(request('PATCH', { baseRevision: 0, command }), draftId);
      expect(response.status).toBe(400);
      expect((await response.json()).message).not.toContain('storage');
    }
  });
});
