import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { conversationService } from '@/src/server/domain/messaging/conversation.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const conversations = await conversationService.getUserConversations(user.id);

    return NextResponse.json(conversations, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to list conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot create conversations' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { kind, recipientId, title, participantIds } = body || {};

    if (kind === 'DIRECT') {
      if (!recipientId || typeof recipientId !== 'string') {
        return NextResponse.json(
          { error: 'recipientId is required for direct conversations' },
          { status: 400 }
        );
      }

      const result = await conversationService.createDirectConversation(user.id, recipientId);
      return NextResponse.json(result, {
        status: result.isExisting ? 200 : 201,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    if (kind === 'GROUP') {
      if (!title || typeof title !== 'string' || !Array.isArray(participantIds)) {
        return NextResponse.json(
          { error: 'title and participantIds array are required for group conversations' },
          { status: 400 }
        );
      }

      const result = await conversationService.createGroupConversation(
        user.id,
        title,
        participantIds
      );
      return NextResponse.json(result, {
        status: 201,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    return NextResponse.json(
      { error: 'Invalid kind: must be DIRECT or GROUP' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    );
  }
}
