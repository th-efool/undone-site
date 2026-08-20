import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await Promise.resolve(params); // Next 15 compatibility

    await prisma.cohortMember.create({
      data: {
        userId,
        cohortId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to join cohort', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
