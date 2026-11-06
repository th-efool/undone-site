import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { studyroomPolicy } from './studyroom.policy';

export async function lockUser(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
}

export async function lockRooms(tx: Prisma.TransactionClient, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT id FROM study_rooms WHERE id = ${id} FOR UPDATE`;
  }
}

export async function hasRoomAccess(roomId: string, userId: string, control = false, client: Prisma.TransactionClient = prisma) {
  const room = await client.studyRoom.findUnique({ where: { id: roomId } });
  if (!room) return false;
  const lease = await client.roomLease.findFirst({
    where: { studyRoomId: roomId, userId, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!lease) return false;
  if (!control) return (await studyroomPolicy.resolveRoomEligibility(room,userId,true,client)).eligible;
  const capabilities = await studyroomPolicy.evaluateCapabilities(room, userId, undefined, true,client);
  return capabilities.canJoin && (!control || capabilities.canControlEnvironment);
}
