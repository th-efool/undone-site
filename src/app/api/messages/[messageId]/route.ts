import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { interactionService } from '@/src/server/domain/messaging/interaction.service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot edit messages' },
        { status: 403 }
      );
    }

    const { messageId } = await params;
    const body = await req.json().catch(() => ({}));
    const { content, expectedRevision } = body || {};

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Content must be a string' }, { status: 400 });
    }

    const result = await interactionService.editMessage({
      messageId,
      userId: user.id,
      content,
      expectedRevision: typeof expectedRevision === 'number' ? expectedRevision : undefined,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to edit message:', error);
    const status =
      error.name === 'MessagingForbiddenError'
        ? 403
        : error.name === 'MessagingConflictError'
        ? 409
        : error.name === 'MessagingNotFoundError'
        ? 404
        : 400;

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot delete messages' },
        { status: 403 }
      );
    }

    const { messageId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason : undefined;

    const result = await interactionService.deleteMessage({
      messageId,
      userId: user.id,
      reason,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to delete message:', error);
    const status =
      error.name === 'MessagingForbiddenError'
        ? 403
        : error.name === 'MessagingNotFoundError'
        ? 404
        : 400;

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status }
    );
  }
}
