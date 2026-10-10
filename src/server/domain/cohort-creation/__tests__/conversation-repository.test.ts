import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {} }));
import { appendCreationConversation, createCreationConversationRepository } from '@/src/server/infrastructure/db/postgres/repositories/creationConversation.repo';
import type { Prisma } from '@/generated/prisma/client';
import { conversationEntrySchema } from '@/src/shared/cohort-creation/review';

const entry = () => conversationEntrySchema.parse({ id: randomUUID(), draftId: randomUUID(), requestId: randomUUID(), role: 'assistant',
  message: 'Proposed title change.', proposal: { message: 'Proposed title change.', changes: [{ type: 'title', value: 'Clearer title' }] }, createdAt: new Date().toISOString() });
describe('owned conversation repository', () => {
  it('refuses foreign or expired draft writes before insertion', async () => {
    const tx = { $queryRaw: vi.fn(async () => []), $executeRaw: vi.fn(async () => 1) }; const value = entry();
    expect(await appendCreationConversation(tx as unknown as Prisma.TransactionClient, 'foreign', value.draftId, value)).toBe(false);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('supports idempotent retries despite JSONB key ordering, and rejects changed payloads', async () => {
    const value = entry(); const query = vi.fn().mockResolvedValueOnce([{ id: value.draftId }]).mockResolvedValueOnce([
      { ...value, proposal: { changes: [{ value: 'Clearer title', type: 'title' }], message: value.message } }]);
    const tx = { $queryRaw: query, $executeRaw: vi.fn(async () => 0) };
    expect(await appendCreationConversation(tx as unknown as Prisma.TransactionClient, 'owner', value.draftId, value)).toBe(true);
    query.mockResolvedValueOnce([{ id: value.draftId }]).mockResolvedValueOnce([{ ...value, message: 'Different payload' }]);
    expect(await appendCreationConversation(tx as unknown as Prisma.TransactionClient, 'owner', value.draftId, value)).toBe(false);
  });
  it('validates draft/cursor identifiers and pagination limits before querying', async () => {
    const query = vi.fn(async () => []);
    const repo = createCreationConversationRepository({ $queryRaw: query } as unknown as Parameters<typeof createCreationConversationRepository>[0]);
    await expect(repo.list('owner', 'bad')).rejects.toThrow(); await expect(repo.list('owner', randomUUID(), { before: 'bad' })).rejects.toThrow();
    await expect(repo.list('owner', randomUUID(), { limit: 101 })).rejects.toThrow(); expect(query).not.toHaveBeenCalled();
    expect(await repo.list('owner', randomUUID(), { before: randomUUID(), limit: 5 })).toEqual([]);
    expect(query).toHaveBeenCalledOnce();
  });
});
