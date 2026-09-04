import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { requireUser } from '@/src/server/infrastructure/auth/requireUser';
import { MessageDeliveryStatus } from '@/generated/prisma/client';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { conversationId, content, clientId, attachments } = body;

    if (!conversationId || !content || !clientId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let pendingMessage;
    try {
      pendingMessage = await prisma.pendingMessage.create({
        data: {
          conversationId,
          content,
          clientId,
          authorId: user.id!,
          attachments: attachments || null,
          status: MessageDeliveryStatus.SENDING,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Unique constraint failed on clientId
        pendingMessage = await prisma.pendingMessage.findUnique({
          where: { clientId },
        });
      } else {
        throw e;
      }
    }

    // Publish to Centrifugo
    const payload = {
      channel: `conversation:${conversationId}`,
      data: {
        id: pendingMessage?.id,
        conversationId,
        content,
        clientId,
        authorId: user.id!,
        attachments: attachments || null,
        status: pendingMessage?.status,
      },
    };

    const centrifugoRes = await fetch(`${process.env.CENTRIFUGO_API_URL}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `apikey ${process.env.CENTRIFUGO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!centrifugoRes.ok) {
      const errorText = await centrifugoRes.text();
      console.error('Centrifugo publish error:', errorText);
      return NextResponse.json({ error: 'Failed to publish message' }, { status: 500 });
    }

    return NextResponse.json({ success: true, pendingMessage });
  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }
    console.error('Error in chat/send route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
