import { NextResponse } from 'next/server';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { compactPayload } from '@/src/shared/lib/compactPayload';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { messageService } from '@/src/server/domain/messaging/message.service';
import {
  MessagingConflictError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '@/src/server/domain/messaging/contracts';

export const dynamic = 'force-dynamic';

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

    const { channelId } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const rawContent =
      typeof body === 'object' && body !== null && 'content' in body
        ? (body as { content: unknown }).content
        : undefined;

    if (typeof rawContent !== 'string') {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const clientRequestId =
      typeof body === 'object' &&
      body !== null &&
      'clientRequestId' in body &&
      typeof (body as Record<string, unknown>).clientRequestId === 'string'
        ? (body as { clientRequestId: string }).clientRequestId
        : undefined;

    const replyToId =
      typeof body === 'object' &&
      body !== null &&
      'replyToId' in body &&
      typeof (body as Record<string, unknown>).replyToId === 'string'
        ? (body as { replyToId: string }).replyToId
        : undefined;

    try {
      const result = await messageService.sendMessage({
        channelId,
        authorId: user.id,
        content: rawContent,
        clientRequestId,
        replyToId,
      });

      return NextResponse.json(compactPayload(result.message), {
        status: result.isIdempotentReplay ? 200 : 201,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (domainErr) {
      if (domainErr instanceof MessagingConflictError) {
        return NextResponse.json({ error: domainErr.message }, { status: 409 });
      }
      if (domainErr instanceof MessagingForbiddenError) {
        return NextResponse.json({ error: domainErr.message }, { status: 403 });
      }
      if (domainErr instanceof MessagingNotFoundError) {
        return NextResponse.json({ error: domainErr.message }, { status: 404 });
      }
      if (domainErr instanceof MessagingValidationError) {
        return NextResponse.json({ error: domainErr.message }, { status: 400 });
      }
      throw domainErr;
    }
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
        conversation: {
          select: {
            participants: {
              where: { leftAt: null },
              select: { userId: true },
            },
          },
        },
        studyRoom: {
          select: {
            id: true,
            status: true,
            cohortId: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    if (channel.community) {
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
    } else if (channel.conversation) {
      const isParticipant = channel.conversation.participants.some(
        (p) => p.userId === user.id
      );
      if (!isParticipant) {
        return NextResponse.json(
          { error: 'Not an active participant in this conversation' },
          { status: 403 }
        );
      }
    } else if (channel.studyRoom) {
      if (!['active', 'open'].includes(channel.studyRoom.status?.toLowerCase())) {
        return NextResponse.json({ error: 'Study room is not active' }, { status: 403 });
      }

      if (channel.studyRoom.cohortId && prisma.cohortMember?.findUnique) {
        const membership = await prisma.cohortMember.findUnique({
          where: {
            cohortId_userId: {
              cohortId: channel.studyRoom.cohortId,
              userId: user.id,
            },
          },
        });
        if (!membership) {
          return NextResponse.json(
            { error: 'Cohort enrollment required to view messages' },
            { status: 403 }
          );
        }
      }

      const activeLease = await prisma.roomLease.findFirst({
        where: {
          studyRoomId: channel.studyRoom.id,
          userId: user.id,
          expiresAt: { gt: new Date() },
        },
      });

      if (!activeLease) {
        const participant = await prisma.roomParticipant.findFirst({
          where: {
            studyRoomId: channel.studyRoom.id,
            userId: user.id,
          },
        });
        if (!participant) {
          return NextResponse.json(
            { error: 'Not an active participant in this study room' },
            { status: 403 }
          );
        }
      }
    } else {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
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
