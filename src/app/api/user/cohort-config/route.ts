import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { invalidateHomeServerCache } from '@/src/server/infrastructure/cache/homeServerCache';
import {
  UserCohortConfig,
  VALID_FREQUENCIES,
  VALID_ORDER_STYLES,
  VALID_SCHEDULE_DAYS,
  type CohortFrequency,
  type CohortOrderStyle,
  type ScheduleDay,
} from '@/src/server/database/mongo/models/UserCohortConfig';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await connectToMongoDB();
    } catch (connError: any) {
      console.error('[API User Cohort Config GET] DB connection failure:', connError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const configs = await UserCohortConfig.find({ userId }).sort({ rank: 1 }).lean().exec();

    const formattedConfigs = configs.map((c: any) => ({
      cohortId: c.cohortId,
      rank: c.rank ?? 0,
      dailyGoalMinutes: c.dailyGoalMinutes ?? 20,
      scheduleDays: c.scheduleDays ?? ['Mon', 'Wed', 'Fri'],
      scheduleLabel: c.scheduleLabel ?? 'Mon, Wed, Fri',
      frequency: c.frequency ?? 'Often',
      orderStyle: c.orderStyle ?? 'Sequential',
      isPaused: !!c.isPaused,
      isHidden: !!c.isHidden,
      pausedUntil: c.pausedUntil ? new Date(c.pausedUntil).toISOString() : null,
      pausedReason: c.pausedReason || '',
      updatedAt: c.updatedAt,
    }));

    return NextResponse.json(formattedConfigs);
  } catch (error: any) {
    console.error('[API User Cohort Config GET Error]:', error);
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

    // Support batch rank reordering
    if (Array.isArray(body.cohorts)) {
      if (body.cohorts.length > 200) {
        return NextResponse.json({ error: 'Too many cohorts in batch' }, { status: 400 });
      }

      // Validate cohort entries
      for (const item of body.cohorts) {
        if (!item || typeof item.cohortId !== 'string' || typeof item.rank !== 'number' || item.rank < 0) {
          return NextResponse.json(
            { error: 'Invalid batch item: each must have string cohortId and positive number rank' },
            { status: 400 }
          );
        }
      }

      try {
        await connectToMongoDB();
      } catch (connError: any) {
        console.error('[API User Cohort Config PUT] DB connection failure:', connError);
        return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
      }

      const updates = await Promise.all(
        body.cohorts.map(async (item: { cohortId: string; rank: number }) => {
          const cleanId = item.cohortId.startsWith(`${userId}_`)
            ? item.cohortId.slice(userId.length + 1)
            : item.cohortId;

          return UserCohortConfig.findOneAndUpdate(
            { userId, cohortId: cleanId },
            { $set: { rank: Math.round(item.rank) } },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
          ).lean().exec();
        })
      );

      return NextResponse.json({ success: true, count: updates.filter(Boolean).length });
    }

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
    } = body;

    if (!cohortId || typeof cohortId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid cohortId' }, { status: 400 });
    }

    const cleanCohortId = cohortId.startsWith(`${userId}_`)
      ? cohortId.slice(userId.length + 1)
      : cohortId;

    const updateFields: Record<string, any> = {};

    if (rank !== undefined) {
      if (typeof rank !== 'number' || rank < 0) {
        return NextResponse.json({ error: 'rank must be a non-negative number' }, { status: 400 });
      }
      updateFields.rank = Math.round(rank);
    }

    if (dailyGoalMinutes !== undefined) {
      const numGoal = Number(dailyGoalMinutes);
      if (isNaN(numGoal) || numGoal < 1 || numGoal > 1440) {
        return NextResponse.json(
          { error: 'dailyGoalMinutes must be an integer between 1 and 1440' },
          { status: 400 }
        );
      }
      updateFields.dailyGoalMinutes = Math.round(numGoal);
    }

    if (scheduleDays !== undefined) {
      if (!Array.isArray(scheduleDays) || !scheduleDays.every((d) => VALID_SCHEDULE_DAYS.includes(d as ScheduleDay))) {
        return NextResponse.json(
          {
            error: `scheduleDays must be an array of weekdays: ${VALID_SCHEDULE_DAYS.join(', ')}`,
          },
          { status: 400 }
        );
      }
      updateFields.scheduleDays = scheduleDays;
    }

    if (scheduleLabel !== undefined) {
      updateFields.scheduleLabel = String(scheduleLabel).slice(0, 100);
    }

    if (frequency !== undefined) {
      if (!VALID_FREQUENCIES.includes(frequency as CohortFrequency)) {
        return NextResponse.json(
          {
            error: `Invalid frequency '${frequency}'. Allowed: ${VALID_FREQUENCIES.join(', ')}`,
          },
          { status: 400 }
        );
      }
      updateFields.frequency = frequency;
    }

    if (orderStyle !== undefined) {
      if (!VALID_ORDER_STYLES.includes(orderStyle as CohortOrderStyle)) {
        return NextResponse.json(
          {
            error: `Invalid orderStyle '${orderStyle}'. Allowed: ${VALID_ORDER_STYLES.join(', ')}`,
          },
          { status: 400 }
        );
      }
      updateFields.orderStyle = orderStyle;
    }

    if (isPaused !== undefined) {
      updateFields.isPaused = Boolean(isPaused);
    }

    if (pausedUntil !== undefined) {
      if (pausedUntil === null || pausedUntil === '') {
        updateFields.pausedUntil = null;
      } else {
        const parsedDate = new Date(pausedUntil);
        if (isNaN(parsedDate.getTime())) {
          return NextResponse.json({ error: 'pausedUntil must be a valid date' }, { status: 400 });
        }
        updateFields.pausedUntil = parsedDate;
      }
    }

    if (pausedReason !== undefined) {
      updateFields.pausedReason = String(pausedReason).slice(0, 500);
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    try {
      await connectToMongoDB();
    } catch (connError: any) {
      console.error('[API User Cohort Config PUT] DB connection failure:', connError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const updatedConfig = await UserCohortConfig.findOneAndUpdate(
      { userId, cohortId: cleanCohortId },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean().exec();

    invalidateHomeServerCache(userId);

    return NextResponse.json(updatedConfig);
  } catch (error: any) {
    console.error('[API User Cohort Config PUT Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
