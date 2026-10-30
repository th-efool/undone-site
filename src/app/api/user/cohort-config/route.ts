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
import {
  normalizeCohortId,
  getUserAuthorizedCohortIds,
  executeCohortStateChange,
} from '@/src/server/domain/home/cohortOrder.service';

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
      console.error('[API User Cohort Config GET] DB connection failure:', connError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const configs = await UserCohortConfig.find({ userId }).sort({ rank: 1 }).lean().exec();

    const formattedConfigs = configs.map((c) => ({
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
  } catch (error: unknown) {
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

    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 1. Discriminated membership state change operation (pause/resume)
    if (body.operation === 'pause' || body.operation === 'resume') {
      const { operation, cohortId, pausedUntil, pausedReason } = body;
      if (!cohortId || typeof cohortId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid cohortId' }, { status: 400 });
      }

      try {
        const result = await executeCohortStateChange(userId, {
          operation,
          cohortId,
          pausedUntil: pausedUntil as string | undefined,
          pausedReason: pausedReason as string | undefined,
        });
        return NextResponse.json({ success: true, ...result });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update cohort state';
        if (message.includes('Unauthorized') || message.includes('unauthorized')) {
          return NextResponse.json({ error: message }, { status: 403 });
        }
        if (message.includes('not found')) {
          return NextResponse.json({ error: message }, { status: 404 });
        }
        if (message.includes('valid future date') || message.includes('invalid cohortId')) {
          return NextResponse.json({ error: message }, { status: 400 });
        }
        if (message.includes('does not support replica set transactions') || message.includes('transaction')) {
          return NextResponse.json({ error: message }, { status: 503 });
        }
        console.error('[API User Cohort Config PUT StateChange Error]:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
      }
    }

    // 2. Batch rank reordering
    if (Array.isArray(body.cohorts)) {
      if (body.cohorts.length > 200) {
        return NextResponse.json({ error: 'Too many cohorts in batch' }, { status: 400 });
      }

      if (body.cohorts.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }

      // Validate cohort entries, finite ranks, and uniqueness
      const seenIds = new Set<string>();
      for (const item of body.cohorts) {
        if (
          !item ||
          typeof item.cohortId !== 'string' ||
          !item.cohortId.trim() ||
          typeof item.rank !== 'number' ||
          !Number.isFinite(item.rank) ||
          item.rank < 1 ||
          !Number.isInteger(item.rank)
        ) {
          return NextResponse.json(
            { error: 'Invalid batch item: each must have string cohortId and positive integer rank' },
            { status: 400 }
          );
        }
        const cleanId = normalizeCohortId(item.cohortId, userId);
        if (seenIds.has(cleanId)) {
          return NextResponse.json({ error: `Duplicate cohortId '${cleanId}' in batch` }, { status: 400 });
        }
        seenIds.add(cleanId);
      }

      // Validate authorized visible cohort IDs
      const authorizedIds = await getUserAuthorizedCohortIds(userId);
      for (const cleanId of seenIds) {
        if (!authorizedIds.has(cleanId)) {
          return NextResponse.json(
            { error: `Cohort '${cleanId}' is not accessible` },
            { status: 403 }
          );
        }
      }

      try {
        await connectToMongoDB();
      } catch (connError: unknown) {
        console.error('[API User Cohort Config PUT] DB connection failure:', connError);
        return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
      }

      const bulkOps = (body.cohorts as Array<{ cohortId: string; rank: number }>).map((item) => {
        const cleanId = normalizeCohortId(item.cohortId, userId);

        return {
          updateOne: {
            filter: { userId, cohortId: cleanId },
            update: {
              $set: { rank: item.rank },
              $setOnInsert: {
                dailyGoalMinutes: 20,
                scheduleDays: ['Mon', 'Wed', 'Fri'] as ScheduleDay[],
                scheduleLabel: 'Mon, Wed, Fri',
                frequency: 'Often' as CohortFrequency,
                orderStyle: 'Sequential' as CohortOrderStyle,
                isPaused: false,
                isHidden: false,
              },
            },
            upsert: true,
          },
        };
      });

      const bulkResult = await UserCohortConfig.bulkWrite(bulkOps, { ordered: false });
      const count = (bulkResult.modifiedCount || 0) + (bulkResult.upsertedCount || 0);

      // Invalidate Home cache after successful batch write
      invalidateHomeServerCache(userId);

      return NextResponse.json({ success: true, count });
    }

    // 3. Single cohort configuration update
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

    const cleanCohortId = normalizeCohortId(cohortId, userId);

    const authorizedIds = await getUserAuthorizedCohortIds(userId);
    if (!authorizedIds.has(cleanCohortId)) {
      return NextResponse.json(
        { error: `Cohort '${cleanCohortId}' is not accessible` },
        { status: 403 }
      );
    }

    const updateFields: Record<string, unknown> = {};

    if (rank !== undefined) {
      if (typeof rank !== 'number' || !Number.isFinite(rank) || rank < 0) {
        return NextResponse.json({ error: 'rank must be a non-negative finite number' }, { status: 400 });
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
        const parsedDate = new Date(pausedUntil as string | number | Date);
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
    } catch (connError: unknown) {
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
  } catch (error: unknown) {
    console.error('[API User Cohort Config PUT Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
