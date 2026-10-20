import { NextResponse } from 'next/server';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { compactPayload } from '@/src/shared/lib/compactPayload';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_CONTENT_LENGTH = 4000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot send community messages' },
        { status: 403 }
      );
    }

    // Check user messaging restrictions
    const restriction = await prisma.userRestriction.findUnique({
      where: { userId: user.id },
      select: { expiresAt: true },
    });
    if (restriction && (!restriction.expiresAt || restriction.expiresAt > new Date())) {
      return NextResponse.json(
        { error: 'Messaging privileges are restricted for this account' },
        { status: 403 }
      );
    }

    const { channelId } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const content = typeof body === 'object' && body !== null && 'content' in body
      ? (body as { content: unknown }).content
      : undefined;

    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Message content exceeds maximum allowed length of ${MAX_MESSAGE_CONTENT_LENGTH} characters` },
        { status: 400 }
      );
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        community: {
          select: {
            cohortId: true,
            chatEnabled: true,
            cohort: {
              select: { creatorId: true },
            },
          },
        },
      },
    });

    if (!channel || !channel.community) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    if (!channel.community.chatEnabled) {
      return NextResponse.json({ error: 'Chat is disabled for this community' }, { status: 403 });
    }

    const { cohortId, cohort } = channel.community;
    const isCreator = cohort.creatorId === user.id;
    let isMember = isCreator;

    if (!isMember) {
      const membership = await prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId, userId: user.id } },
        select: { role: true },
      });
      isMember = Boolean(membership);
    }

    if (!isMember) {
      return NextResponse.json(
        { error: 'Active cohort membership is required to post in this channel' },
        { status: 403 }
      );
    }

    const message = await communityRepo.addMessage(channelId, user.id, trimmedContent);

    return NextResponse.json(compactPayload(message), {
      status: 201,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
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

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot access community messages' },
        { status: 403 }
      );
    }

    const { channelId } = await params;
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        community: {
          select: {
            cohortId: true,
            chatEnabled: true,
            cohort: {
              select: { creatorId: true },
            },
          },
        },
      },
    });

    if (!channel || !channel.community) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    if (!channel.community.chatEnabled) {
      return NextResponse.json({ error: 'Chat is disabled for this community' }, { status: 403 });
    }

    const { cohortId, cohort } = channel.community;
    const isCreator = cohort.creatorId === user.id;
    let isMember = isCreator;

    if (!isMember) {
      const membership = await prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId, userId: user.id } },
        select: { role: true },
      });
      isMember = Boolean(membership);
    }

    if (!isMember) {
      return NextResponse.json(
        { error: 'Active cohort membership is required to view messages' },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const before = url.searchParams.get('before') || undefined;

    const messages = await communityRepo.getChannelMessages(channelId, limit, before);

    // Reverse to return in chronological order for UI display
    return NextResponse.json(compactPayload([...messages].reverse()), {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to get channel messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
