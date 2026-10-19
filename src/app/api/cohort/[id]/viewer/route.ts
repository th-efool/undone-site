import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;
  const headers = { 'Cache-Control': 'private, no-store' };

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ enrolled: false }, { headers });
    }

    const member = await prisma.cohortMember.findUnique({
      where: {
        cohortId_userId: {
          cohortId,
          userId,
        },
      },
      select: { role: true },
    });

    return NextResponse.json({ enrolled: Boolean(member) }, { headers });
  } catch (error) {
    console.error('Failed to resolve cohort viewer state:', error);
    return NextResponse.json({ enrolled: false }, { status: 500, headers });
  }
}
