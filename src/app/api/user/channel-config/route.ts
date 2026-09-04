import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { UserChannelConfig } from '@/src/server/database/mongo/models/UserChannelConfig';

export async function GET(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToMongoDB();
    const config = await UserChannelConfig.findOne({ userId });

    return NextResponse.json(config || {});
  } catch (error: any) {
    console.error('[API User Channel Config GET Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) ?? {};
    const { activeChannel, prefs } = body;

    const updateFields: any = {};
    if (activeChannel !== undefined) updateFields.activeChannel = activeChannel;
    if (prefs !== undefined) updateFields.prefs = prefs;

    await connectToMongoDB();

    const updatedConfig = await UserChannelConfig.findOneAndUpdate(
      { userId },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json(updatedConfig);
  } catch (error: any) {
    console.error('[API User Channel Config PUT Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
