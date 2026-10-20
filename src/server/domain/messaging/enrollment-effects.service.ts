import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { UserCohortConfig } from '@/src/server/database/mongo/models/UserCohortConfig';

export interface EnrollmentEffectParams {
  userId: string;
  cohortId: string;
  action: 'enroll' | 'hide' | 'unhide' | 'leave';
}

export interface EnrollmentEffectResult {
  success: boolean;
  action: string;
  error?: string;
}

/**
 * Reconciles secondary MongoDB learner preferences following authoritative PostgreSQL cohort enrollment/leave actions.
 * In accordance with Phase 2 requirements (2.18), SQL membership is the primary authority;
 * MongoDB failures do not compromise SQL state or roll back enrollment.
 */
export async function syncEnrollmentMongoPreferences(
  params: EnrollmentEffectParams
): Promise<EnrollmentEffectResult> {
  const { userId, cohortId, action } = params;

  try {
    await connectToMongoDB();

    let updateDoc: Record<string, unknown> = {};

    switch (action) {
      case 'enroll':
      case 'unhide':
        updateDoc = {
          $set: { isHidden: false, isPaused: false },
          $unset: { pausedUntil: 1, pausedReason: 1 },
        };
        break;
      case 'hide':
        updateDoc = {
          $set: { isHidden: true },
        };
        break;
      case 'leave':
        updateDoc = {
          $set: { isHidden: true, isPaused: true },
        };
        break;
    }

    await UserCohortConfig.updateOne(
      { userId, cohortId },
      updateDoc,
      { upsert: true }
    ).exec();

    return { success: true, action };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[enrollment-effects] Secondary MongoDB update failed for ${action} (userId: ${userId}, cohortId: ${cohortId}):`, errorMsg);
    return { success: false, action, error: errorMsg };
  }
}
