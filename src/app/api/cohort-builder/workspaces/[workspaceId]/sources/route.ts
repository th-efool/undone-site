import { z } from 'zod';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { assertSourceSchema, sourceCapability } from '@/src/server/domain/cohort-builder/source-policy';
import { youtubeTranscriptReadiness } from '@/src/server/domain/cohort-builder/youtube-transcript-policy';
import { youtubeVideoReadiness } from '@/src/server/domain/cohort-builder/youtube-video-policy';
import { githubSourceReadiness } from '@/src/server/domain/cohort-builder/github-policy';

export const dynamic = 'force-dynamic';

const verifiedSourcesWorkspaces = new Map<string, number>();
const WORKSPACE_VERIFY_TTL_MS = 60_000;

export function clearVerifiedSourcesWorkspacesCacheForTests(): void {
  verifiedSourcesWorkspaces.clear();
}

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const ownerId = await getCreationOwner();
  const headers = { 'Cache-Control': 'private, no-store' };

  if (!ownerId || !z.uuid().safeParse(workspaceId).success) {
    return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
  }

  const now = Date.now();
  const cacheKey = `${workspaceId}:${ownerId}`;
  const lastVerified = verifiedSourcesWorkspaces.get(cacheKey);
  const isVerified = lastVerified !== undefined && now - lastVerified < WORKSPACE_VERIFY_TTL_MS;

  if (!isVerified) {
    const workspace = await prisma.interactionWorkspace.findFirst({
      where: { id: workspaceId, ownerId, domainId: 'cohort', lifecycle: 'active' },
      select: { id: true },
    });
    if (!workspace) {
      return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
    }
    if (verifiedSourcesWorkspaces.size >= 1000) {
      for (const [key, timestamp] of verifiedSourcesWorkspaces.entries()) {
        if (now - timestamp >= WORKSPACE_VERIFY_TTL_MS) {
          verifiedSourcesWorkspaces.delete(key);
        }
      }
    }
    verifiedSourcesWorkspaces.set(cacheKey, now);
  }

  let ready = process.env.INTERACTION_TEXT_DRIVER === 'durable';
  if (ready) {
    try {
      await assertSourceSchema({
        query: async (statement, parameters) => ({
          rows: (await prisma.$queryRawUnsafe(statement, ...parameters)) as Record<string, unknown>[],
        }),
      });
    } catch {
      ready = false;
    }
  }

  const ytTranscript = youtubeTranscriptReadiness();
  const ytVideo = youtubeVideoReadiness();
  const youtubeEnabled = ytVideo.enabled || ytTranscript.enabled;
  const github = githubSourceReadiness();

  const payload = {
    pdf: ready && sourceCapability('pdf'),
    web: ready && sourceCapability('web'),
    youtube: youtubeEnabled,
    youtubeUnavailableReason: ytVideo.code ?? ytTranscript.code,
    youtubeVideo: ytVideo.enabled,
    youtubeTranscript: ytTranscript.enabled,
    github: ready && sourceCapability('github'),
    githubUnavailableReason: github.code ?? 'GITHUB_CAPABILITY_DISABLED',
    pdfBytes: 2 * 1024 * 1024,
    webBytes: 1024 * 1024,
  };

  const etag = 'W/"' + Buffer.from(JSON.stringify(payload)).toString('base64').slice(0, 24) + '"';

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ...headers, ETag: etag } });
  }

  return Response.json(payload, { headers: { ...headers, ETag: etag } });
}
