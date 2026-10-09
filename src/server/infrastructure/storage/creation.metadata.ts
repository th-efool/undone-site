import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '../db/postgres/client';
import {
  CREATION_STORAGE_LIMITS as limits, CreationStorageError,
  type CreationStorageMetadata, type CreationStorageRecord, type StorageScope,
} from './creation.contracts';

async function lockDraft(tx: Prisma.TransactionClient, scope: StorageScope) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM creation_drafts WHERE id = ${scope.draftId} AND "ownerId" = ${scope.ownerId} FOR UPDATE`);
  if (!rows.length) throw new CreationStorageError('NOT_FOUND', 'The draft was not found.');
}
const busy = (draftId: string) => Prisma.sql`
  EXISTS (SELECT 1 FROM creation_jobs j WHERE j."draftId" = ${draftId} AND j.status IN ('queued', 'running'))`;

/** Raw SQL keeps byte reservation, pinning and reclamation atomic across worker processes. */
export const creationStorageMetadata: CreationStorageMetadata = {
  async reserve(input, draftLimit) {
    await prisma.$transaction(async tx => {
      await lockDraft(tx, input);
      const [{ used }] = await tx.$queryRaw<{ used: bigint }[]>(Prisma.sql`
        SELECT COALESCE(SUM(CASE WHEN status = 'ready' THEN "byteLength" ELSE "reservedBytes" END), 0)::bigint AS used
        FROM creation_storage_objects WHERE "draftId" = ${input.draftId}`);
      if (Number(used) + input.reservedBytes > draftLimit) throw new CreationStorageError('LIMIT_EXCEEDED', 'The draft storage allowance is full.');
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO creation_storage_objects
          (id, "blobId", "ownerId", "draftId", kind, status, "mediaType", filename, "reservedBytes", "byteLength",
           "artifactType", "schemaVersion", "inputFingerprint", "createdAt", "updatedAt")
        VALUES (${input.id}, ${input.blobId}, ${input.ownerId}, ${input.draftId}, ${input.kind}, 'uploading',
          ${input.mediaType}, ${input.filename}, ${input.reservedBytes}, 0, ${input.artifactType}, ${input.schemaVersion},
          ${input.inputFingerprint}, NOW(), NOW())`);
    });
  },
  async complete(scope, id, bytes, checksum) {
    return (await prisma.$executeRaw(Prisma.sql`
      UPDATE creation_storage_objects SET status = 'ready', "byteLength" = ${bytes}, checksum = ${checksum},
        "completedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = ${id} AND "ownerId" = ${scope.ownerId} AND "draftId" = ${scope.draftId}
        AND status = 'uploading' AND "reservedBytes" >= ${bytes}`)) === 1;
  },
  async find(scope, id) {
    const rows = await prisma.$queryRaw<CreationStorageRecord[]>(Prisma.sql`
      SELECT o.* FROM creation_storage_objects o JOIN creation_drafts d ON d.id = o."draftId"
      WHERE o.id = ${id} AND o."ownerId" = ${scope.ownerId} AND o."draftId" = ${scope.draftId} AND d."ownerId" = ${scope.ownerId}`);
    return rows[0] ?? null;
  },
  async pin(scope, id, published) {
    return (await prisma.$executeRaw(Prisma.sql`
      UPDATE creation_storage_objects SET "referencedAt" = NOW(),
        "publishedAt" = CASE WHEN ${published} THEN COALESCE("publishedAt", NOW()) ELSE "publishedAt" END, "updatedAt" = NOW()
      WHERE id = ${id} AND "ownerId" = ${scope.ownerId} AND "draftId" = ${scope.draftId} AND status = 'ready'`)) === 1;
  },
  async protectRead(scope, id, until) {
    return (await prisma.$executeRaw(Prisma.sql`
      UPDATE creation_storage_objects SET "readLeaseUntil" = GREATEST("readLeaseUntil", ${until})
      WHERE id = ${id} AND "ownerId" = ${scope.ownerId} AND "draftId" = ${scope.draftId} AND status = 'ready'`)) === 1;
  },
  async claimDeletion(scope, id, token, before) {
    return prisma.$transaction(async tx => {
      await lockDraft(tx, scope);
      const rows = await tx.$queryRaw<CreationStorageRecord[]>(Prisma.sql`
        UPDATE creation_storage_objects SET status = 'deleting', "deletingToken" = ${token}, "updatedAt" = NOW()
        WHERE id = ${id} AND "ownerId" = ${scope.ownerId} AND "draftId" = ${scope.draftId}
          AND "referencedAt" IS NULL AND "publishedAt" IS NULL AND NOT ${busy(scope.draftId)}
          AND ("readLeaseUntil" IS NULL OR "readLeaseUntil" <= NOW())
          ${before ? Prisma.sql`AND ("createdAt" <= ${before} OR (status = 'deleting' AND "updatedAt" < NOW() - INTERVAL '5 minutes'))` : Prisma.empty}
          AND (status != 'deleting' OR "updatedAt" < NOW() - INTERVAL '5 minutes')
        RETURNING *`);
      return rows[0] ?? null;
    });
  },
  async finishDeletion(scope, id, token) {
    return (await prisma.$executeRaw(Prisma.sql`
      DELETE FROM creation_storage_objects WHERE id = ${id} AND "ownerId" = ${scope.ownerId}
        AND "draftId" = ${scope.draftId} AND status = 'deleting' AND "deletingToken" = ${token}
        AND "referencedAt" IS NULL AND "publishedAt" IS NULL`)) === 1;
  },
  async candidates(now, limit) {
    return prisma.$queryRaw<CreationStorageRecord[]>(Prisma.sql`
      SELECT o.* FROM creation_storage_objects o WHERE "referencedAt" IS NULL AND "publishedAt" IS NULL
        AND ("readLeaseUntil" IS NULL OR "readLeaseUntil" <= ${now})
        AND ((status = 'uploading' AND "createdAt" <= ${new Date(now.getTime() - limits.incompleteAgeMs)})
          OR (status = 'ready' AND "createdAt" <= ${new Date(now.getTime() - limits.unreferencedAgeMs)})
          OR (status = 'deleting' AND "updatedAt" <= ${new Date(now.getTime() - 5 * 60 * 1000)}))
        AND NOT EXISTS (SELECT 1 FROM creation_jobs j WHERE j."draftId" = o."draftId" AND j.status IN ('queued', 'running'))
      ORDER BY "createdAt", id LIMIT ${limit}`);
  },
  async expiredDrafts(now, limit) {
    // Reference release belongs to draft/publication transactions, not a storage sweeper.
    return prisma.$queryRaw<StorageScope[]>(Prisma.sql`
      SELECT d.id AS "draftId", d."ownerId" FROM creation_drafts d
      WHERE d."updatedAt" <= ${new Date(now.getTime() - limits.draftAgeMs)}
        AND NOT EXISTS (SELECT 1 FROM creation_jobs j WHERE j."draftId" = d.id AND j.status IN ('queued', 'running'))
        AND NOT EXISTS (SELECT 1 FROM creation_storage_objects o WHERE o."draftId" = d.id AND o."publishedAt" IS NOT NULL)
      ORDER BY d."updatedAt", d.id LIMIT ${limit}`);
  },
};
