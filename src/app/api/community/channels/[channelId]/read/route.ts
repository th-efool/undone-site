import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { interactionService } from '@/src/server/domain/messaging/interaction.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot update read state' },
        { status: 403 }
      );
    }

    const { channelId } = await params;
    const body = await req.json().catch(() => ({}));
    const sequence = typeof body?.sequence === 'number' ? body.sequence : 0;

    const result = await interactionService.updateReadWatermark({
      channelId,
      userId: user.id,
      sequence,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to update read watermark:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.name === 'MessagingForbiddenError' ? 403 : 400 }
    );
  }
}
