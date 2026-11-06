import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';

export async function emitRoomChange(tx: Prisma.TransactionClient, roomId: string, type: string, payload: Prisma.InputJsonObject) {
  const stream = await tx.realtimeStream.upsert({where:{studyRoomId:roomId},
    create:{studyRoomId:roomId,generation:1,eventCounter:1},update:{eventCounter:{increment:1}}});
  const eventId = randomUUID();
  await tx.realtimeEvent.create({data:{eventId,streamId:stream.id,sequence:stream.eventCounter,
    generation:stream.generation,schemaVersion:1,type,payload}});
  await tx.realtimeDelivery.create({data:{eventId,destination:`room:${roomId}:g${stream.generation}`,status:'PENDING'}});
}
