import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import {
  UserChannelConfig,
  type ChannelId,
} from '@/src/server/database/mongo/models/UserChannelConfig';
import {
  VALID_CHANNEL_IDS,
  validatePrefEntry,
} from '@/src/shared/feed/channelPreferences';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await connectToMongoDB();
    } catch (connError: unknown) {
      console.error('[API User Channel Config GET] DB connection failure:', connError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const config = await UserChannelConfig.findOne({ userId }).lean().exec();

    const prefsObj: Record<string, string> = {};
    if (config?.prefs) {
      const rawMap =
        config.prefs instanceof Map
          ? Object.fromEntries(config.prefs)
          : typeof config.prefs === 'object'
          ? (config.prefs as Record<string, unknown>)
          : {};
      for (const [key, val] of Object.entries(rawMap)) {
        const validation = validatePrefEntry(key, val);
        if (validation.valid && validation.normalizedKey && validation.normalizedVal) {
          prefsObj[validation.normalizedKey] = validation.normalizedVal;
        }
      }
    }

    return NextResponse.json({
      activeChannel: (config?.activeChannel as ChannelId) || 'default',
      prefs: prefsObj,
    });
  } catch (error: unknown) {
    console.error('[API User Channel Config GET Error]:', error);
    return NextResponse.json({ error: 'Failed to retrieve channel configuration' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = (await req.json()) ?? {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const bodyObj = body as { activeChannel?: unknown; prefs?: unknown };
    const { activeChannel, prefs } = bodyObj;
    const updateFields: Record<string, unknown> = {};

    if (activeChannel !== undefined) {
      if (!VALID_CHANNEL_IDS.includes(activeChannel as ChannelId)) {
        return NextResponse.json(
          { error: 'Invalid active channel parameter' },
          { status: 400 }
        );
      }
      updateFields.activeChannel = activeChannel;
    }

    if (prefs !== undefined) {
      if (typeof prefs !== 'object' || prefs === null || Array.isArray(prefs)) {
        return NextResponse.json({ error: 'Preferences must be an object' }, { status: 400 });
      }

      const entries = Object.entries(prefs);
      if (entries.length > 50) {
        return NextResponse.json({ error: 'Too many preference parameters' }, { status: 400 });
      }

      const sanitizedPrefs: Record<string, string> = {};
      for (const [key, val] of entries) {
        const validation = validatePrefEntry(key, val);
        if (!validation.valid || !validation.normalizedKey || !validation.normalizedVal) {
          return NextResponse.json(
            { error: `Invalid preference parameter: ${key}` },
            { status: 400 }
          );
        }
        sanitizedPrefs[validation.normalizedKey] = validation.normalizedVal;
      }
      updateFields.prefs = sanitizedPrefs;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    try {
      await connectToMongoDB();
    } catch (connError: unknown) {
      console.error('[API User Channel Config PUT] DB connection failure:', connError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const updatedConfig = await UserChannelConfig.findOneAndUpdate(
      { userId },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean().exec();

    const prefsObj: Record<string, string> = {};
    if (updatedConfig?.prefs) {
      const rawMap =
        updatedConfig.prefs instanceof Map
          ? Object.fromEntries(updatedConfig.prefs)
          : typeof updatedConfig.prefs === 'object'
          ? (updatedConfig.prefs as Record<string, unknown>)
          : {};
      for (const [key, val] of Object.entries(rawMap)) {
        const validation = validatePrefEntry(key, val);
        if (validation.valid && validation.normalizedKey && validation.normalizedVal) {
          prefsObj[validation.normalizedKey] = validation.normalizedVal;
        }
      }
    }

    return NextResponse.json({
      activeChannel: (updatedConfig?.activeChannel as ChannelId) || 'default',
      prefs: prefsObj,
    });
  } catch (error: unknown) {
    console.error('[API User Channel Config PUT Error]:', error);
    return NextResponse.json({ error: 'Failed to update channel configuration' }, { status: 500 });
  }
}
