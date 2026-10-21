import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { userRepo } from '@/src/server/infrastructure/db/postgres/repositories/user.repo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile
 * Returns current authenticated user's profile details including username
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
        bio: true,
        role: true,
        createdAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(dbUser, {
      headers: { 'Cache-Control': 'private, no-cache' },
    });
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/profile
 * Update current authenticated user's name, bio, or image
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { name?: string; bio?: string; image?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { name, bio, image } = body ?? {};
    const updated = await userRepo.update(user.id, {
      name: typeof name === 'string' ? name.trim().slice(0, 100) : undefined,
      bio: typeof bio === 'string' ? bio.trim().slice(0, 500) : undefined,
      image: typeof image === 'string' ? image.trim() : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: updated.id,
          name: updated.name,
          username: updated.username,
          image: updated.image,
          bio: updated.bio,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
