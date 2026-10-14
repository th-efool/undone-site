import { z } from 'zod';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params; const ownerId = await getCreationOwner();
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!ownerId || !z.uuid().safeParse(workspaceId).success || !await prisma.interactionWorkspace.findFirst({ where: { id: workspaceId, ownerId }, select: { id: true } })) {
    return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
  }
  const turns = await prisma.$queryRaw<Array<{ messageId: string; runId: string | null; status: string }>>`
    SELECT m.id AS "messageId", r.id AS "runId", COALESCE(r.status,'pending') AS status
    FROM interaction_messages m LEFT JOIN LATERAL
      (SELECT id,status FROM interaction_runs WHERE "workspaceId"=m."workspaceId" AND "triggeringMessageId"=m.id ORDER BY "createdAt" DESC LIMIT 1) r ON true
    WHERE m."workspaceId"=${workspaceId} AND m.role='user' ORDER BY m.sequence DESC LIMIT 50`;
  return Response.json({ turns }, { headers });
}
