import type { Prisma } from '@/generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { expireStalledRecommendation, recommendationExpired, creationQueueExpired } from '@/src/server/infrastructure/db/postgres/repositories/creationRecommendationTimeout';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';

const now = new Date('2026-10-11T00:00:00Z');
const queued = { status: 'queued', createdAt: new Date(now.getTime() - 60_001), deadlineAt: null };
function fixture() {
  const running = applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', query: result.intent.rawQuery, requestId: result.requestId });
  const job = { ...queued, id: 'job', kind: 'recommendations', requestId: result.requestId };
  const tx = { creationDraft: { findFirst: vi.fn(async () => ({ snapshot: running })) },
    $queryRaw: vi.fn(async () => [{ snapshot: running }]),
    creationJob: { findFirst: vi.fn(async () => job), update: vi.fn(async () => ({ ...job, status: 'failed' })) } };
  const persist = vi.fn();
  const expire = () => expireStalledRecommendation(tx as unknown as Prisma.TransactionClient, 'owner', draftId, persist, now);
  return { tx, persist, expire, running };
}
describe('bounded recommendation wait', () => {
  it.each(['acquire_text', 'acquire_web', 'acquire_pdf', 'inspect_youtube', 'observe_youtube', 'acquire_github', 'acquire_notion', 'discover_material', 'understand_material', 'chunk_material', 'analyze_material', 'build_curriculum', 'refine_curriculum', 'finalize_creation'])('bounds unclaimed %s without shortening execution', kind => {
    const job = { ...queued, kind, createdAt: new Date(now.getTime() - 300_000) };
    expect(creationQueueExpired(job, now)).toBe(true);
    expect(creationQueueExpired({ ...job, createdAt: now }, now)).toBe(false);
    expect(creationQueueExpired({ ...job, deadlineAt: now }, now)).toBe(false);
    expect(creationQueueExpired({ ...job, status: 'running' }, now)).toBe(false);
    expect(creationQueueExpired({ ...job, status: 'succeeded' }, now)).toBe(false);
  });
  it('expires queued searches at the start window and running searches only at their saved deadline', () => {
    expect(recommendationExpired(queued, now)).toBe(true);
    expect(recommendationExpired({ ...queued, createdAt: now }, now)).toBe(false);
    expect(recommendationExpired({ ...queued, status: 'running', deadlineAt: new Date(now.getTime() + 1) }, now)).toBe(false);
    expect(recommendationExpired({ ...queued, status: 'running', deadlineAt: now }, now)).toBe(true);
    expect(recommendationExpired({ ...queued, status: 'succeeded' }, now)).toBe(false);
  });
  it('fences expired work and persists an authoritative retryable failure', async () => {
    const f = fixture(); await f.expire();
    expect(f.tx.creationJob.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ ownerId: 'owner', requestId: result.requestId, inputRevision: f.running.inputRevision }) });
    expect(f.tx.creationJob.update).toHaveBeenCalledWith({ where: { id: 'job' }, data: expect.objectContaining({ status: 'failed', leaseToken: null, leaseUntil: null }) });
    expect(f.persist).toHaveBeenCalledWith(f.tx, 'owner', expect.objectContaining({ status: 'failed', activeRequestId: null,
      error: expect.objectContaining({ code: 'AI_TIMEOUT', retryable: true }) }), 'job_failed', expect.anything());
  });
  it('fails unclaimed acquisition with a retryable saved-material outcome', async () => {
    const f = fixture();
    let state = applyEvent(f.running, { type: 'recommendations_received', result });
    state = applyCommand(applyCommand(state, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
    state = applyCommand(state, { type: 'acquire_web', materialId: draftId, requestId: result.requestId, url: 'https://example.com/article' });
    f.tx.creationDraft.findFirst.mockResolvedValueOnce({ snapshot: state }); f.tx.$queryRaw.mockResolvedValueOnce([{ snapshot: state }]);
    f.tx.creationJob.findFirst.mockResolvedValueOnce({ ...queued, id: 'job', kind: 'acquire_web', requestId: result.requestId, createdAt: new Date(now.getTime() - 300_001) });
    await f.expire();
    expect(f.persist).toHaveBeenCalledWith(f.tx, 'owner', expect.objectContaining({ status: 'failed',
      materials: [expect.objectContaining({ status: 'failed', input: { kind: 'url', url: 'https://example.com/article' } })],
      error: expect.objectContaining({ code: 'DATA_UNAVAILABLE', retryable: true }) }), 'job_failed', expect.anything());
  });
  it('does not change foreign or missing drafts', async () => {
    const f = fixture(); f.tx.creationDraft.findFirst.mockResolvedValueOnce(null as never); await f.expire();
    expect(f.tx.$queryRaw).not.toHaveBeenCalled(); expect(f.persist).not.toHaveBeenCalled();
  });
  it('rechecks under lock so a completed zero-result response wins the race', async () => {
    const f = fixture(); const finished = applyEvent(f.running, { type: 'recommendations_received', result: { ...result, items: [] } });
    f.tx.$queryRaw.mockResolvedValueOnce([{ snapshot: finished }]); await f.expire();
    expect(f.tx.creationJob.findFirst).not.toHaveBeenCalled(); expect(f.persist).not.toHaveBeenCalled();
  });
  it('does not fail a fresh job or a mismatched/missing operation', async () => {
    const f = fixture(); f.tx.creationJob.findFirst.mockResolvedValueOnce({ ...queued, kind: 'recommendations', id: 'job', requestId: result.requestId, createdAt: now });
    await f.expire(); expect(f.persist).not.toHaveBeenCalled();
    f.tx.creationJob.findFirst.mockResolvedValueOnce(null as never); await f.expire(); expect(f.persist).not.toHaveBeenCalled();
  });
});
