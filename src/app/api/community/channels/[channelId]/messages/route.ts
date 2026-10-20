import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { NextResponse } from 'next/server';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { compactPayload } from '@/src/shared/lib/compactPayload';

export const dynamic = 'force-dynamic';

const verifiedChannels = new Map<string, number>();
const CHANNEL_VERIFY_TTL_MS = 60_000;

export function clearVerifiedChannelsForTests(): void {
  verifiedChannels.clear();
}

function isChannelVerified(channelId: string, userId: string): boolean {
  const cacheKey = `${channelId}:${userId}`;
  const expiresAt = verifiedChannels.get(cacheKey);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    verifiedChannels.delete(cacheKey);
    return false;
  }
  return true;
}

function recordChannelVerified(channelId: string, userId: string): void {
  if (verifiedChannels.size >= 1000) {
    const now = Date.now();
    for (const [key, exp] of verifiedChannels.entries()) {
      if (exp <= now) verifiedChannels.delete(key);
    }
  }
  verifiedChannels.set(`${channelId}:${userId}`, Date.now() + CHANNEL_VERIFY_TTL_MS);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const authorId = user.id;

    const channel = await prisma.channel.findFirst({
      where: { id: channelId, community: { cohort: accessibleCohortWhere(authorId) } },
      select: { id: true },
    });
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    recordChannelVerified(channelId, authorId);

    const message = await communityRepo.addMessage(channelId, authorId, content);

    return NextResponse.json(compactPayload(message));
  } catch (error) {
    console.error('Failed to add message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { channelId } = await params;
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const before = url.searchParams.get('before') || undefined;

    if (!isChannelVerified(channelId, user.id)) {
      const channel = await prisma.channel.findFirst({
        where: { id: channelId, community: { cohort: accessibleCohortWhere(user.id) } },
        select: { id: true },
      });
      if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      recordChannelVerified(channelId, user.id);
    }

    const messages = await communityRepo.getChannelMessages(channelId, limit, before);

    const latest = messages[0]; // descending order before reverse
    const etag = latest
      ? `W/"${latest.id}:${new Date(latest.createdAt).getTime()}:${messages.length}"`
      : 'W/"empty"';

    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'private, no-cache',
          ETag: etag,
        },
      });
    }

    // Reverse to return in chronological order for UI display
    return NextResponse.json(compactPayload([...messages].reverse()), {
      headers: {
        'Cache-Control': 'private, no-cache',
        ETag: etag,
      },
    });
  } catch (error) {
    console.error('Failed to get channel messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
