import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { Chunk } from '@/src/server/database/mongo/models/Chunk';
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

describe('GET /api/feed pagination slicing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should paginate items according to pageIndex and limit', async () => {
    const mockItems = Array.from({ length: 15 }, (_, i) => ({
      chunkId: `chunk_${i}`,
      chunkTitle: `Chunk ${i}`,
    }));

    vi.mocked(generateFeed).mockReturnValue({
      items: mockItems as any,
    } as any);

    const req = new NextRequest('http://localhost/api/feed?pageIndex=1&limit=5');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(5);
    expect(json.items[0].chunkId).toBe('chunk_5');
    expect(json.items[4].chunkId).toBe('chunk_9');
  });
});
