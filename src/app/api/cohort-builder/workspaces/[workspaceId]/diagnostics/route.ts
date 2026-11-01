import { z } from 'zod';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const headers = { 'Cache-Control': 'private, no-store' };
  const ownerId = await getCreationOwner();
  if (!ownerId || !z.uuid().safeParse(workspaceId).success) return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
  try {
    const runs = await prisma.$queryRaw<Array<{ id: string; status: string; createdAt: Date; updatedAt: Date; category: string | null }>>`
      SELECT r.id, r.status, r."createdAt", r."updatedAt",
        CASE WHEN r.error IS NULL THEN NULL
          WHEN r.error ILIKE '%high demand%' OR r.error ILIKE '%503%' THEN 'PROVIDER_BUSY'
          WHEN r.error ILIKE '%timeout%' OR r.error ILIKE '%abort%' THEN 'TIMEOUT_OR_CANCEL'
          ELSE 'RUN_FAILED' END AS category
      FROM interaction_runs r JOIN interaction_workspaces w ON w.id=r."workspaceId"
      WHERE w.id=${workspaceId} AND w."ownerId"=${ownerId}
      ORDER BY r."createdAt" DESC LIMIT 20`;
    const owned = await prisma.interactionWorkspace.findFirst({ where: { id: workspaceId, ownerId }, select: { id: true } });
    if (!owned) return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
    return Response.json({ runs }, { headers });
  } catch {
    return Response.json({ code: 'DIAGNOSTICS_UNAVAILABLE' }, { status: 503, headers });
  }
}
