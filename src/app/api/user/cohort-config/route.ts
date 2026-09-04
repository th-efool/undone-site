import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { UserCohortConfig } from '@/src/server/database/mongo/models/UserCohortConfig';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToMongoDB();

    const configs = await UserCohortConfig.find({ userId });
    return NextResponse.json(configs);
  } catch (error: any) {
    console.error('[API User Cohort Config GET Error]:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error?.message === 'string'
        ? error.message
        : 'Internal Server Error';
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
    const {
      cohortId,
      rank,
      dailyGoalMinutes,
      scheduleDays,
      scheduleLabel,
      frequency,
      orderStyle,
      isPaused,
      pausedUntil,
      pausedReason,
      ...otherFields
    } = body;

    if (!cohortId) {
      return NextResponse.json({ error: 'Missing cohortId' }, { status: 400 });
    }

    const updateCandidates: Record<string, any> = {
      rank,
      dailyGoalMinutes,
      scheduleDays,
      scheduleLabel,
      frequency,
      orderStyle,
      isPaused,
      pausedUntil,
      pausedReason,
      ...otherFields,
    };

    const updateFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateCandidates)) {
      if (value !== undefined) {
        updateFields[key] = value;
      }
    }

    await connectToMongoDB();

    const updatedConfig = await UserCohortConfig.findOneAndUpdate(
      { userId, cohortId },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json(updatedConfig);
  } catch (error: any) {
    console.error('[API User Cohort Config PUT Error]:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error?.message === 'string'
        ? error.message
        : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
