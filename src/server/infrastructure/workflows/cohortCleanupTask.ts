import { task, type TaskContext } from '@renderinc/sdk/workflows';
import { prisma } from '../db/postgres/client';

export const cleanDraftCohorts = task(
  { 
    name: 'cleanDraftCohorts',
    retry: {
      maxRetries: 3,
      waitDurationMs: 1000,
      backoffScaling: 1.5,
    }
  },
  async function cleanDraftCohorts(ctx: TaskContext): Promise<{ deletedCount: number }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await prisma.cohort.deleteMany({
      where: {
        isPublished: false,
        updatedAt: {
          lt: oneHourAgo,
        },
      },
    });
    
    console.log(`Cleaned up ${result.count} stale draft cohorts.`);
    
    return { deletedCount: result.count };
  }
);
