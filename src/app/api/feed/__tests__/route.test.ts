import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { UserChunkProgress } from '@/src/server/database/mongo/models/UserChunkProgress';
import { Chunk } from '@/src/server/database/mongo/models/Chunk';
import { computeTargetVector } from '@/src/shared/curriculum/pedagogicalVector.engine';
import { generateFeed } from '@/src/shared/feed/feedEngine';

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

  it('should simulate MongoDB $vectorSearch returning chunks and verify pass to generateFeed', async () => {
    const mockChunks = [
      {
        chunkId: 'chunk1',
        title: 'Chunk 1',
        chunkIndex: 0,
        duration: 180,
        startSeconds: 0,
        endSeconds: 180,
        lessonId: 'lesson1',
        cohortId: 'cohort1',
        isStrictlyLinear: false,
        isKeyConcept: true,
        vector: [0.1, 0.2, 0.3],
      },
      {
        chunkId: 'chunk2',
        title: 'Chunk 2',
        chunkIndex: 1,
        duration: 120,
        startSeconds: 180,
        endSeconds: 300,
        lessonId: 'lesson1',
        cohortId: 'cohort1',
        isStrictlyLinear: true,
        isKeyConcept: false,
        vector: [0.4, 0.5, 0.6],
      }
    ];

    vi.mocked(Chunk.aggregate as any).mockResolvedValue(mockChunks);

    const req = new NextRequest('http://localhost/api/feed?channel=default');
    const response = await GET(req);
    const json = await response.json();

    expect(Chunk.aggregate).toHaveBeenCalled();
    expect(generateFeed).toHaveBeenCalled();

    const generateFeedArgs = vi.mocked(generateFeed).mock.calls[0][0];

    // Verify allChunks are passed in correctly
    expect(generateFeedArgs.allChunks).toHaveLength(2);
    expect(generateFeedArgs.allChunks[0]).toEqual(expect.objectContaining({
      chunkId: 'chunk1',
      chunkTitle: 'Chunk 1',
      chunkOrder: 1,
      chunkDuration: '3 min',
    }));
    expect(generateFeedArgs.allChunks[1]).toEqual(expect.objectContaining({
      chunkId: 'chunk2',
      chunkTitle: 'Chunk 2',
      chunkOrder: 2,
      chunkDuration: '2 min',
    }));

    // Verify successful response
    expect(response.status).toBe(200);
    expect(json).toEqual({ items: [] });
  });

  it('should correctly offset the timezone for chronobiological math', async () => {
    vi.mocked(Chunk.aggregate as any).mockResolvedValue([]);

    const now = Date.now();
    const req = new NextRequest('http://localhost/api/feed?timezoneOffset=120'); // 120 minutes = 2 hours
    await GET(req);

    expect(generateFeed).toHaveBeenCalled();
    const generateFeedArgs = vi.mocked(generateFeed).mock.calls[0][0];
    const computedTime = generateFeedArgs.currentTime.getTime();
    
    // Expected time is 'now' minus 120 minutes
    const expectedTime = now - 120 * 60 * 1000;
    const diff = Math.abs(computedTime - expectedTime);
    
    expect(diff).toBeLessThan(100); // Allow 100ms tolerance
    
    // Also verify that computeTargetVector received the same time
    const computeArgs = vi.mocked(computeTargetVector).mock.calls[0][0];
    expect(computeArgs.currentTime).toEqual(generateFeedArgs.currentTime);
  });
});
