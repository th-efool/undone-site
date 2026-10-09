import { describe, expect, it, vi } from 'vitest';
import { maintainCreationDrafts, type CreationRetentionRepository } from '../retention';

function fixture() {
  const repository: CreationRetentionRepository = {
    expireInactive: vi.fn(async () => 2),
    finalizeExpired: vi.fn(async () => 1),
    prune: vi.fn(async () => ({ events: 4, budgets: 3 })),
  };
  const storage = vi.fn(async () => ({ removed: ['blob'], failed: ['retry'] }));
  return { repository, storage };
}
describe('creation retention orchestration', () => {
  it('detaches references before bytes, then finalizes drafts and prunes replay', async () => {
    const { repository, storage } = fixture();
    expect(await maintainCreationDrafts(repository, storage)).toMatchObject({
      expired: 2, deleted: 1, events: 4, budgets: 3, storage: { failed: ['retry'] },
    });
    const order = [repository.expireInactive, storage, repository.finalizeExpired, repository.prune]
      .map(operation => vi.mocked(operation).mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
  it('leaves tombstones recoverable when storage reconciliation is unavailable', async () => {
    const { repository, storage } = fixture();
    storage.mockRejectedValueOnce(new Error('Mongo unavailable'));
    await expect(maintainCreationDrafts(repository, storage)).rejects.toThrow('Mongo unavailable');
    expect(repository.finalizeExpired).not.toHaveBeenCalled();
    expect(repository.prune).not.toHaveBeenCalled();
    await expect(maintainCreationDrafts(repository, storage)).resolves.toMatchObject({ deleted: 1 });
  });
  it('does not touch storage when the expiry transaction fails', async () => {
    const { repository, storage } = fixture();
    vi.mocked(repository.expireInactive).mockRejectedValue(new Error('SQL unavailable'));
    await expect(maintainCreationDrafts(repository, storage)).rejects.toThrow('SQL unavailable');
    expect(storage).not.toHaveBeenCalled();
  });
  it('rejects an invalid clock before any work', async () => {
    const { repository, storage } = fixture();
    await expect(maintainCreationDrafts(repository, storage, new Date(NaN))).rejects.toThrow('Invalid maintenance clock');
    expect(repository.expireInactive).not.toHaveBeenCalled();
  });
});
