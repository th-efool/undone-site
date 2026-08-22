import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { UserChunkProgress } from '@/src/server/database/mongo/models/UserChunkProgress';
import { Chunk } from '@/src/server/database/mongo/models/Chunk';
import { computeTargetVector } from '@/src/shared/curriculum/pedagogicalVector.engine';
import { generateFeed } from '@/src/shared/feed/feedEngine';

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test_user_id' } }),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohortMember: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    lesson: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'lesson1',
          title: 'Lesson 1',
          order: 1,
          thumbnailUrl: '',
          videoId: 'oHg5SJYRHA0',
          seasonId: 'season1',
          season: {
            id: 'season1',
            title: 'Season 1',
            order: 1,
            cohortId: 'cohort1',
            cohort: {
              id: 'cohort1',
              title: 'Cohort 1',
              coverImage: '',
            }
          },
          chunks: [
            {
              id: 'chunk1',
              title: 'Chunk 1',
              order: 1,
              duration: '3m',
              startSeconds: 0,
              endSeconds: 180,
            },
            {
              id: 'chunk2',
              title: 'Chunk 2',
              order: 2,
              duration: '2m',
              startSeconds: 180,
              endSeconds: 300,
            }
          ]
        }
      ]),
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({
  connectToMongoDB: vi.fn(),
}));

vi.mock('@/src/server/database/mongo/models/UserChunkProgress', () => ({
  UserChunkProgress: {
    find: vi.fn(() => ({
      sort: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('@/src/server/database/mongo/models/Chunk', () => ({
  Chunk: {
    aggregate: vi.fn(),
  },
}));

vi.mock('@/src/shared/curriculum/pedagogicalVector.engine', () => ({
  computeTargetVector: vi.fn().mockReturnValue({
    cognitive_load: 0,
    practicality_actionability: 0,
    visual_dependence: 0,
    scaffolding_guidance: 0,
    linearity_dependency: 0,
    novelty_divergence: 0,
    abstraction_depth: 0,
    pacing_density: 0,
    rigor_formality: 0,
    interactivity_agency: 0,
    breadth_scope: 0,
    emotional_energy: 0,
  }),
}));

vi.mock('@/src/shared/feed/feedEngine', () => ({
  generateFeed: vi.fn().mockReturnValue({ items: [] }),
}));

describe('GET /api/feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch candidate lessons from Postgres and pass them to generateFeed', async () => {
    const req = new NextRequest('http://localhost/api/feed?channel=default');
    const response = await GET(req);
    const json = await response.json();

    expect(generateFeed).toHaveBeenCalled();

    const generateFeedArgs = vi.mocked(generateFeed).mock.calls[0][0];

    // Verify allChunks are passed in correctly
    expect(generateFeedArgs.allChunks).toHaveLength(2);
    expect(generateFeedArgs.allChunks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chunkId: 'chunk1',
        chunkTitle: 'Chunk 1',
        chunkOrder: 1,
      }),
      expect.objectContaining({
        chunkId: 'chunk2',
        chunkTitle: 'Chunk 2',
        chunkOrder: 2,
      }),
    ]));

    // Verify successful response
    expect(response.status).toBe(200);
    expect(json).toEqual({ items: [] });
  });

  it('should correctly offset the timezone for chronobiological math', async () => {
    const now = Date.now();
    const req = new NextRequest('http://localhost/api/feed?timezoneOffset=120'); // 120 minutes = 2 hours
    await GET(req);

    expect(generateFeed).toHaveBeenCalled();
    const generateFeedArgs = vi.mocked(generateFeed).mock.calls[0][0];
    const computedTime = generateFeedArgs.currentTime.getTime();
    
    // Expected time is 'now' minus 120 minutes
    const expectedTime = now - 120 * 60 * 1000;
    const diff = Math.abs(computedTime - expectedTime);
    
    expect(diff).toBeLessThan(1000); // Allow 1s tolerance
  });
});
