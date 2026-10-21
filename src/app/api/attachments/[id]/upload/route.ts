import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { attachmentService } from '@/src/server/domain/attachments/attachment.service';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot upload files' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const summary = await attachmentService.uploadFile({
      attachmentId: id,
      userId: user.id,
      buffer,
    });

    return NextResponse.json(summary, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to upload attachment:', error);
    const status =
      error.name === 'MessagingForbiddenError'
        ? 403
        : error.name === 'MessagingNotFoundError'
        ? 404
        : 400;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  }
}
