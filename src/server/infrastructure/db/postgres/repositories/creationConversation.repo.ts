import 'server-only';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma as defaultPrisma } from '../client';
import { conversationEntrySchema, type ConversationEntry } from '@/src/shared/cohort-creation/review';

type Row = Omit<ConversationEntry, 'createdAt'> & { createdAt: Date };
export interface CreationConversationRepository {
  append(ownerId: string, draftId: string, entry: ConversationEntry): Promise<boolean>;
  list(ownerId: string, draftId: string, options?: { before?: string; limit?: number }): Promise<ConversationEntry[]>;
}
export async function appendCreationConversation(tx: Prisma.TransactionClient, ownerId: string, draftId: string, value: ConversationEntry): Promise<boolean> {
  const entry = conversationEntrySchema.parse(value); z.uuid().parse(draftId);
  if (entry.draftId !== draftId) throw new Error('Conversation draft mismatch');
      const owned = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "creation_drafts"
        WHERE "id"=${draftId} AND "ownerId"=${ownerId} AND "expiredAt" IS NULL FOR SHARE`;
      if (!owned.length) return false;
      const inserted = await tx.$executeRaw`INSERT INTO "creation_conversation_entries"
        ("id","draftId","requestId","role","message","proposal","createdAt")
        VALUES (${entry.id},${draftId},${entry.requestId},${entry.role},${entry.message},${JSON.stringify(entry.proposal)}::jsonb,${new Date(entry.createdAt)})
        ON CONFLICT DO NOTHING`;
      if (inserted === 1) return true;
      const existing = await tx.$queryRaw<Row[]>`SELECT "id","draftId","requestId","role","message","proposal","createdAt"
        FROM "creation_conversation_entries" WHERE "draftId"=${draftId} AND "requestId"=${entry.requestId} AND "role"=${entry.role}`;
      return existing.length === 1 && existing[0].message === entry.message && isDeepStrictEqual(existing[0].proposal, entry.proposal);
}

/** Conversation history is explanatory only; owner-scoped draft snapshots remain authoritative. */
export function createCreationConversationRepository(prisma = defaultPrisma): CreationConversationRepository { return {
  async append(ownerId, draftId, value) {
    return prisma.$transaction(tx => appendCreationConversation(tx, ownerId, draftId, value));
  },
  async list(ownerId, draftId, options = {}) {
    z.uuid().parse(draftId); const limit = z.number().int().min(1).max(100).parse(options.limit ?? 30);
    if (options.before) z.uuid().parse(options.before);
    const rows = options.before ? await prisma.$queryRaw<Row[]>`SELECT e."id",e."draftId",e."requestId",e."role",e."message",e."proposal",e."createdAt"
      FROM "creation_conversation_entries" e JOIN "creation_drafts" d ON d."id"=e."draftId"
      JOIN "creation_conversation_entries" cursor ON cursor."id"=${options.before} AND cursor."draftId"=d."id"
      WHERE d."id"=${draftId} AND d."ownerId"=${ownerId} AND d."expiredAt" IS NULL
      AND (e."createdAt",e."id") < (cursor."createdAt",cursor."id") ORDER BY e."createdAt" DESC,e."id" DESC LIMIT ${limit}`
      : await prisma.$queryRaw<Row[]>`SELECT e."id",e."draftId",e."requestId",e."role",e."message",e."proposal",e."createdAt"
      FROM "creation_conversation_entries" e JOIN "creation_drafts" d ON d."id"=e."draftId"
      WHERE d."id"=${draftId} AND d."ownerId"=${ownerId} AND d."expiredAt" IS NULL
      ORDER BY e."createdAt" DESC,e."id" DESC LIMIT ${limit}`;
    return rows.map(row => conversationEntrySchema.parse({ ...row, createdAt: row.createdAt.toISOString() }));
  },
}; }
export const creationConversationRepo = createCreationConversationRepository();
