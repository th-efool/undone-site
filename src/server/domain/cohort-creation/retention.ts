export interface CreationRetentionRepository {
  expireInactive(now: Date, limit: number): Promise<number>;
  finalizeExpired(limit: number): Promise<number>;
  prune(now: Date, limit: number): Promise<{ events: number; budgets: number }>;
}

/** Byte failures leave tombstones and metadata for a later sweep; SQL never leads byte deletion. */
export async function maintainCreationDrafts<T>(repository: CreationRetentionRepository,
  cleanStorage: () => Promise<T>, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid maintenance clock');
  const expired = await repository.expireInactive(now, 50);
  const storage = await cleanStorage();
  const deleted = await repository.finalizeExpired(50);
  const pruned = await repository.prune(now, 1000);
  return { expired, deleted, ...pruned, storage };
}
