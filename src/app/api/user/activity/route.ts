import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { activityBuffer } from '@/src/server/infrastructure/logging/activityBuffer.service';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    // Handle batch events format
    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return NextResponse.json(
          { error: 'events field must be a non-empty array' },
          { status: 400 }
        );
      }

      for (let i = 0; i < body.events.length; i++) {
        const ev = body.events[i];
        if (
          !ev ||
          typeof ev !== 'object' ||
          !ev.eventType ||
          typeof ev.eventType !== 'string' ||
          !ev.entityId ||
          typeof ev.entityId !== 'string'
        ) {
          return NextResponse.json(
            { error: `Event at index ${i} is missing required eventType or entityId string` },
            { status: 400 }
          );
        }
      }

      for (const ev of body.events) {
        activityBuffer.record({
          userId,
          eventType: ev.eventType,
          entityId: ev.entityId,
          metadata: ev.metadata,
          timestamp: ev.timestamp,
        });
      }

      return NextResponse.json({ success: true, buffered: body.events.length }, { status: 200 });
    }

    // Handle single event format
    const { eventType, entityId, metadata, timestamp } = body;

    if (!eventType || typeof eventType !== 'string' || !entityId || typeof entityId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: eventType and entityId must be non-empty strings' },
        { status: 400 }
      );
    }

    activityBuffer.record({
      userId,
      eventType,
      entityId,
      metadata,
      timestamp,
    });

    return NextResponse.json({ success: true, buffered: 1 }, { status: 200 });
  } catch (error: any) {
    console.error('[API User Activity POST Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
