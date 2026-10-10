import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
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

    const user = await getUser();
    const authorId = user?.id;

    if (!authorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const channel = await prisma.channel.findFirst({ where: { id: channelId,
      community: { cohort: accessibleCohortWhere(authorId) } }, select: { id: true } });
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    const message = await communityRepo.addMessage(channelId, authorId, content);

    return NextResponse.json(message);
  } catch (error) {
    console.error('Failed to add message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
