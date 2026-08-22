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

    const resolvedParams = await Promise.resolve(params); // Next 15 compatibility
    const id = resolvedParams?.id;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
    }

    await prisma.cohortMember.create({
      data: {
        userId,
        cohortId: id.trim(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to join cohort', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
