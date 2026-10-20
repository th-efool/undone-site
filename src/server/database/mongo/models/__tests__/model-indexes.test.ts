import { describe, it, expect } from 'vitest';
import { UserCohortConfig } from '../UserCohortConfig';
import { UserChunkProgress } from '../UserChunkProgress';
import { AiContentCache } from '../AiContentCache';
import { UserWorkspace } from '@/src/server/infrastructure/db/mongodb/models/UserWorkspace';

describe('MongoDB Schema Compound Indexes Coverage', () => {
  it('UserCohortConfig declares required compound indexes', () => {
    const indexes = UserCohortConfig.schema.indexes();
    // Unique user-cohort compound index
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ userId: 1, cohortId: 1 }, expect.objectContaining({ unique: true })],
        [{ userId: 1, rank: 1 }, expect.anything()],
        [{ userId: 1, isHidden: 1 }, expect.anything()],
      ])
    );
  });

  it('UserChunkProgress declares required compound indexes', () => {
    const indexes = UserChunkProgress.schema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ userId: 1, chunkId: 1 }, expect.objectContaining({ unique: true })],
        [{ userId: 1, status: 1 }, expect.anything()],
        [{ userId: 1, cohortId: 1 }, expect.anything()],
        [{ cohortId: 1, status: 1 }, expect.anything()],
      ])
    );
  });

  it('UserWorkspace declares array lookup compound indexes and preserves userId unique index', () => {
    const indexes = UserWorkspace.schema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ userId: 1, 'canvases.id': 1 }, expect.anything()],
        [{ userId: 1, 'notes.id': 1 }, expect.anything()],
      ])
    );

    // Verify userId has unique constraint defined on path
    const userIdPath = UserWorkspace.schema.path('userId') as any;
    expect(userIdPath.options.unique).toBe(true);
    expect(userIdPath.options.index).toBe(true);
  });

  it('AiContentCache declares unique contentHash, operationType compound, and 90-day TTL indexes', () => {
    const indexes = AiContentCache.schema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ contentHash: 1 }, expect.objectContaining({ unique: true })],
        [{ operationType: 1, createdAt: -1 }, expect.anything()],
        [{ createdAt: 1 }, expect.objectContaining({ expireAfterSeconds: 90 * 24 * 3600 })],
      ])
    );
  });
});
