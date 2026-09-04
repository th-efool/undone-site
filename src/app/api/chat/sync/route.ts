import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Find all pending messages in conversations where this user is a member
    const pendingMessages = await prisma.pendingMessage.findMany({
      where: {
        conversation: {
          members: {
            some: {
              userId: userId,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(pendingMessages);
  } catch (error) {
    console.error('[CHAT_SYNC_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
