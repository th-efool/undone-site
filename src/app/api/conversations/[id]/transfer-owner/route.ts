import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { conversationService } from '@/src/server/domain/messaging/conversation.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ error: 'Forbidden for guest accounts' }, { status: 403 });
    }

    const { id: conversationId } = await params;
    const body = await req.json().catch(() => ({}));
    const { newOwnerId } = body;

    if (!newOwnerId) {
      return NextResponse.json({ error: 'newOwnerId is required' }, { status: 400 });
    }

    const result = await conversationService.transferGroupOwnership(
      user.id,
      conversationId,
      newOwnerId
    );

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to transfer group ownership:', error);
    const status = error.message?.includes('not found') ? 404 : 403;
    return NextResponse.json({ error: error.message || 'Failed to transfer ownership' }, { status });
  }
}
