import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import {
  usernameService,
  UsernameValidationError,
  UsernameConflictError,
} from '@/src/server/domain/user/username.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/username?username=<handle>
 * Check if a username is valid and available to be claimed
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username') || searchParams.get('q') || '';

    if (!username) {
      return NextResponse.json(
        { error: 'Query parameter "username" is required', available: false, valid: false },
        { status: 400 }
      );
    }

    const user = await getUser();
    const result = await usernameService.checkAvailability(username, user?.id);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-cache' },
    });
  } catch (error) {
    console.error('Failed to check username availability:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/username
 * Claim or change the current authenticated user's username
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot claim custom usernames' },
        { status: 403 }
      );
    }

    let body: { username?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { username } = body ?? {};
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Field "username" is required' }, { status: 400 });
    }

    const updatedUser = await usernameService.claimUsername(user.id, username);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          username: updatedUser.username,
          image: updatedUser.image,
          bio: updatedUser.bio,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error: any) {
    if (error instanceof UsernameValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof UsernameConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Failed to claim username:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
