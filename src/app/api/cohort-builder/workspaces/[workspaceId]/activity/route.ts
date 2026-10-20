import { z } from 'zod';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export const dynamic = 'force-dynamic';

const OWNER_CACHE_TTL_MS = 60_000;
const verifiedOwnerCache = new Map<string, number>();

function isOwnerVerified(workspaceId: string, ownerId: string): boolean {
  const cacheKey = `${workspaceId}:${ownerId}`;
  const expiresAt = verifiedOwnerCache.get(cacheKey);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    verifiedOwnerCache.delete(cacheKey);
    return false;
  }
  return true;
}

function recordOwnerVerified(workspaceId: string, ownerId: string): void {
  if (verifiedOwnerCache.size >= 1000) {
    const now = Date.now();
    for (const [key, exp] of verifiedOwnerCache.entries()) {
      if (exp <= now) verifiedOwnerCache.delete(key);
    }
  }
  verifiedOwnerCache.set(`${workspaceId}:${ownerId}`, Date.now() + OWNER_CACHE_TTL_MS);
}

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const ownerId = await getCreationOwner();
  const headers = { 'Cache-Control': 'private, no-store' };

  if (!ownerId || !z.uuid().safeParse(workspaceId).success) {
    return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
  }

  if (!isOwnerVerified(workspaceId, ownerId)) {
    const workspace = await prisma.interactionWorkspace.findFirst({
      where: { id: workspaceId, ownerId },
      select: { id: true },
    });
    if (!workspace) {
      return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
    }
    recordOwnerVerified(workspaceId, ownerId);
  }

  const turns =
    (await prisma.$queryRaw<Array<{ messageId: string; runId: string | null; status: string }>>`
      SELECT m.id AS "messageId", r.id AS "runId", COALESCE(r.status,'pending') AS status
      FROM interaction_messages m LEFT JOIN LATERAL
        (SELECT id,status FROM interaction_runs WHERE "workspaceId"=m."workspaceId" AND "triggeringMessageId"=m.id ORDER BY "createdAt" DESC LIMIT 1) r ON true
      WHERE m."workspaceId"=${workspaceId} AND m.role='user' ORDER BY m.sequence DESC LIMIT 50`) ?? [];

  const etagPayload = turns.map((t) => `${t.messageId}:${t.runId ?? ''}:${t.status}`).join('|');
  const etag = `W/"${Buffer.from(etagPayload).toString('base64').slice(0, 32)}"`;

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ...headers, ETag: etag } });
  }

  return Response.json({ turns }, { headers: { ...headers, ETag: etag } });
}
