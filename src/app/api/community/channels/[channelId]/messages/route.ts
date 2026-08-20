import { NextResponse } from 'next/server';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    let user = await getUser();
    let authorId = user?.id;

    if (!authorId) {
      // Fallback to the guest user ID if getUser() is mock/null
      const guestUser = await prisma.user.findUnique({ where: { email: 'guest@sidequesthq.com' } });
      authorId = guestUser?.id || 'guest-user-id';
    }

    const message = await communityRepo.addMessage(channelId, authorId, content);

    return NextResponse.json(message);
  } catch (error) {
    console.error('Failed to add message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
