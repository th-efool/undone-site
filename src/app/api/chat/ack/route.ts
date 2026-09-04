import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { requireUser } from '@/src/server/infrastructure/auth/requireUser';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    // Delete the pending message for the authenticated user
    await prisma.pendingMessage.deleteMany({
      where: {
        clientId,
        authorId: user.id!,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }
    console.error('Error in chat/ack route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
