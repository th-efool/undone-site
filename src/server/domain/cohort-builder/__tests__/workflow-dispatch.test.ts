import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), start: vi.fn(), worker: vi.fn(), transaction: vi.fn() }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {
  $queryRaw: fake.query, $executeRaw: fake.execute, $transaction: fake.transaction,
} }));
vi.mock('workflow/api', () => ({ start: fake.start }));
vi.mock('@/src/server/interaction-worker', () => ({ runInteractionWorkerLoop: fake.worker }));
import { dispatchInteractionExecution } from '@/src/server/interaction-dispatch.runtime';
import { executeInteractionSlice } from '@/src/server/interaction.step';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
  fake.start.mockResolvedValue({ runId: 'workflow' });
  fake.transaction.mockImplementation(work => work({ $queryRaw: fake.query, $executeRaw: fake.execute }));
});
it('starts only after acquiring the durable wake-up reservation', async () => {
  fake.query.mockResolvedValueOnce([{ token: 'reserved' }]).mockResolvedValueOnce([]);
  await dispatchInteractionExecution(); await dispatchInteractionExecution();
  expect(fake.start).toHaveBeenCalledTimes(1);
});
it('releases failed dispatch so the same accepted message can wake execution on retry', async () => {
  fake.query.mockResolvedValue([{ token: 'reserved' }]); fake.start.mockRejectedValue(new Error('transport'));
  await expect(dispatchInteractionExecution()).rejects.toThrow('transport');
  expect(fake.execute).toHaveBeenCalledTimes(1);
});
it('a superseded workflow cannot continue executing the worker', async () => {
  fake.execute.mockResolvedValue(0);
  expect(await executeInteractionSlice('old')).toBe(false);
  expect(fake.worker).not.toHaveBeenCalled();
});
it('executes a bounded canonical worker slice and continues while persisted work remains', async () => {
  fake.execute.mockResolvedValue(1);
  fake.query.mockResolvedValueOnce([{ token: 'current' }]).mockResolvedValueOnce([{ pending: true }]);
  expect(await executeInteractionSlice('current')).toBe(true);
  expect(fake.worker).toHaveBeenCalledWith(expect.objectContaining({ maxIterations: 1 }), expect.any(AbortSignal));
  expect(fake.execute).toHaveBeenCalledTimes(1);
});
it('releases an idle reservation under the same lock used by a new wake-up', async () => {
  fake.execute.mockResolvedValue(1);
  fake.query.mockResolvedValueOnce([{ token: 'current' }]).mockResolvedValueOnce([{ pending: false }]);
  expect(await executeInteractionSlice('current')).toBe(false);
  expect(fake.execute).toHaveBeenCalledTimes(2);
});
