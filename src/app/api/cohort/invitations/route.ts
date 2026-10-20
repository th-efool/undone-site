import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { createCohortInvitation } from '@/src/server/domain/cohort/cohortInvitation.service';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(session.user)) {
      return NextResponse.json({ error: 'Guest accounts cannot create invitations' }, { status: 403 });
    }

    const body = await req.json();
    const { cohortId, email, expiresInDays } = body;

    if (!cohortId || typeof cohortId !== 'string') {
      return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
    }

    const invitation = await createCohortInvitation({
      cohortId,
      inviterId: userId,
      email: typeof email === 'string' ? email : null,
      expiresInDays: typeof expiresInDays === 'number' ? expiresInDays : undefined,
    });

    return NextResponse.json({ success: true, ...invitation }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
