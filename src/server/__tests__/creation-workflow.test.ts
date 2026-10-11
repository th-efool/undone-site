import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ step: vi.fn(), sleep: vi.fn() }));
vi.mock('workflow', () => ({ sleep: mocks.sleep }));
vi.mock('../creation.step', () => ({ executeCreationSlice: mocks.step }));
import { runDurableCreation } from '../creation.workflow';
describe('creation workflow continuation', () => {
  beforeEach(() => vi.clearAllMocks());
  it('durably waits between SQL-controlled slices and stops at completion', async () => {
    mocks.step.mockResolvedValueOnce(10_000).mockResolvedValueOnce(60_000).mockResolvedValueOnce(null);
    const scope = { ownerId: 'alice', draftId: 'draft', requestId: 'request' };
    await runDurableCreation(scope);
    expect(mocks.step).toHaveBeenCalledTimes(3);
    expect(mocks.step).toHaveBeenCalledWith(scope);
    expect(mocks.sleep.mock.calls).toEqual([[10_000], [60_000]]);
  });
  it('does not invent completion when a step fails', async () => {
    mocks.step.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(runDurableCreation({ ownerId: 'alice', draftId: 'draft', requestId: 'request' })).rejects.toThrow('database unavailable');
    expect(mocks.sleep).not.toHaveBeenCalled();
  });
});
