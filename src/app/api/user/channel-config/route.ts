import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import {
  UserChannelConfig,
  VALID_CHANNEL_IDS,
  type ChannelId,
} from '@/src/server/database/mongo/models/UserChannelConfig';

export async function GET(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await connectToMongoDB();
    } catch (connError: any) {
      console.error('[API User Channel Config GET] DB connection failure:', connError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const config = await UserChannelConfig.findOne({ userId }).lean().exec();

    let prefsObj: Record<string, string> = {};
    if (config?.prefs) {
      if (config.prefs instanceof Map) {
        prefsObj = Object.fromEntries(config.prefs);
      } else if (typeof config.prefs === 'object') {
        prefsObj = { ...config.prefs };
      }
    }

    return NextResponse.json({
      activeChannel: config?.activeChannel || 'quick',
      prefs: prefsObj,
    });
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

    let body: any;
    try {
      body = (await req.json()) ?? {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { activeChannel, prefs } = body;

    const updateFields: Record<string, any> = {};

    if (activeChannel !== undefined) {
      if (!VALID_CHANNEL_IDS.includes(activeChannel as ChannelId)) {
        return NextResponse.json(
          {
            error: `Invalid activeChannel '${activeChannel}'. Must be one of: ${VALID_CHANNEL_IDS.join(', ')}`,
          },
          { status: 400 }
        );
      }
      updateFields.activeChannel = activeChannel;
    }

    if (prefs !== undefined) {
      if (typeof prefs !== 'object' || prefs === null || Array.isArray(prefs)) {
        return NextResponse.json({ error: 'prefs must be a key-value object' }, { status: 400 });
      }

      // Sanitize prefs dictionary to ensure plain string key-values without query selector injection
      const sanitizedPrefs: Record<string, string> = {};
      for (const [key, val] of Object.entries(prefs)) {
        if (typeof key === 'string' && key.length > 0 && key.length <= 100 && !key.startsWith('$')) {
          sanitizedPrefs[key] = String(val ?? '').slice(0, 500);
        }
      }
      updateFields.prefs = sanitizedPrefs;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    try {
      await connectToMongoDB();
    } catch (connError: any) {
      console.error('[API User Channel Config PUT] DB connection failure:', connError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const updatedConfig = await UserChannelConfig.findOneAndUpdate(
      { userId },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean().exec();

    let prefsObj: Record<string, string> = {};
    if (updatedConfig?.prefs) {
      if (updatedConfig.prefs instanceof Map) {
        prefsObj = Object.fromEntries(updatedConfig.prefs);
      } else if (typeof updatedConfig.prefs === 'object') {
        prefsObj = { ...updatedConfig.prefs };
      }
    }

    return NextResponse.json({
      activeChannel: updatedConfig?.activeChannel || 'quick',
      prefs: prefsObj,
    });
  } catch (error: any) {
    console.error('[API User Channel Config PUT Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
