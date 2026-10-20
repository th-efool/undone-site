import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { attachmentService } from '@/src/server/domain/attachments/attachment.service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { buffer, filename, mediaType, byteLength } =
      await attachmentService.getDownloadStream({
        attachmentId: id,
        userId: user.id,
      });

    const safeFilename = filename.replace(/["\r\n]/g, '_');

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mediaType,
        'Content-Length': String(byteLength),
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Failed to download attachment:', error);
    const status =
      error.name === 'MessagingForbiddenError'
        ? 403
        : error.name === 'MessagingNotFoundError'
        ? 404
        : 400;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  }
}
