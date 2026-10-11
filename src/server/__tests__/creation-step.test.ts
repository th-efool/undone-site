import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn(), query: vi.fn(), claim: vi.fn(), execute: vi.fn() }));
vi.mock('../infrastructure/db/postgres/client', () => ({ prisma: { creationJob: mocks, $executeRaw: mocks.query } }));
vi.mock('../infrastructure/db/postgres/repositories/creationJob.repo', () => ({ creationJobRepo: { claim: mocks.claim } }));
vi.mock('../creation-execution.runtime', () => ({ executeDurableCreationJob: mocks.execute }));
import { executeCreationSlice } from '../creation.step';
const scope = { ownerId: 'alice', draftId: 'draft', requestId: 'request' };
describe('creation workflow slices', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findFirst.mockResolvedValue({ id: 'job' }); mocks.findUnique.mockResolvedValue(null); mocks.claim.mockResolvedValue(null); });
  it('stops canceled or terminal work before claiming or executing', async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await executeCreationSlice(scope)).toBeNull();
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { ...scope, status: { in: ['queued', 'running'] }, cancelRequestedAt: null } });
  });
  it('claims only the owned request and executes through the shared runner', async () => {
    const job = { id: 'job' }; mocks.claim.mockResolvedValue(job);
    expect(await executeCreationSlice(scope)).toBeNull();
    expect(mocks.claim).toHaveBeenCalledWith('workflow-job', { ...scope, kind: 'any' });
    expect(mocks.execute).toHaveBeenCalledWith(job, expect.any(AbortSignal));
  });
  it('respects persisted retry backoff and stops after cancellation', async () => {
    mocks.findUnique.mockResolvedValue({ status: 'queued', nextRunAt: new Date(Date.now() + 60_000) });
    expect(await executeCreationSlice(scope)).toBeGreaterThan(59_000);
    mocks.findUnique.mockResolvedValue({ status: 'running', cancelRequestedAt: new Date() });
    expect(await executeCreationSlice(scope)).toBeNull();
  });
  it('waits for another worker lease rather than duplicating its work', async () => {
    mocks.findUnique.mockResolvedValue({ status: 'running', leaseUntil: new Date(Date.now() + 80_000) });
    expect(await executeCreationSlice(scope)).toBeGreaterThan(79_000);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
