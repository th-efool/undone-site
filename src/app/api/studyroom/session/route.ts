import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { sessionService, SessionConflictError } from '@/src/server/domain/studyroom/session.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(null, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const session = await sessionService.getActiveSession(user.id);
    return NextResponse.json(session, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to get active study session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ error: 'Guest accounts cannot create study sessions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetDurationSeconds = typeof body?.targetDurationSeconds === 'number' ? body.targetDurationSeconds : 1500; // 25 min default
    const roomId = typeof body?.roomId === 'string' ? body.roomId : null;

    const session = await sessionService.startSession({
      userId: user.id,
      roomId,
      targetDurationSeconds,
    });

    return NextResponse.json(session, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: unknown) {
    console.error('Failed to start study session:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ error: 'Guest accounts cannot modify study sessions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, sessionId } = body ?? {};
    const expectedVersion = typeof body?.expectedVersion === 'number' ? body.expectedVersion : undefined;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const cleanAction = typeof action === 'string' ? action.trim().toLowerCase() : '';

    let updatedSession;
    switch (cleanAction) {
      case 'pause':
        updatedSession = await sessionService.pauseSession({ userId: user.id, sessionId, expectedVersion });
        break;
      case 'resume':
        updatedSession = await sessionService.resumeSession({ userId: user.id, sessionId, expectedVersion });
        break;
      case 'complete':
        updatedSession = await sessionService.completeSession({ userId: user.id, sessionId, expectedVersion });
        break;
      case 'interrupt':
        updatedSession = await sessionService.interruptSession({ userId: user.id, sessionId, expectedVersion });
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Supported: pause, resume, complete, interrupt' }, { status: 400 });
    }

    return NextResponse.json(updatedSession, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: unknown) {
    if (
      error instanceof SessionConflictError ||
      (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 409)
    ) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Version conflict' },
        { status: 409, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }
    console.error('Failed to update study session:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
