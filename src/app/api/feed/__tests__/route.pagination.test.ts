import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { Chunk } from '@/src/server/database/mongo/models/Chunk';

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

describe('GET /api/feed pagination scaling limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should scale the $vectorSearch limit beyond 50 for pageIndex = 2', async () => {
    vi.mocked(Chunk.aggregate as any).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/feed?pageIndex=2');
    await GET(req);

    expect(Chunk.aggregate).toHaveBeenCalled();
    const aggregateArgs = vi.mocked(Chunk.aggregate as any).mock.calls[0][0];

    // Pipeline should be an array
    expect(Array.isArray(aggregateArgs)).toBe(true);

    // Find the $vectorSearch stage
    const vectorSearchStage = aggregateArgs.find((stage: any) => stage.$vectorSearch);
    expect(vectorSearchStage).toBeDefined();

    // For pageIndex 2, limit = 6, searchLimit = Math.max(50, (2 + 1) * 6 + 40) = 58
    expect(vectorSearchStage.$vectorSearch.limit).toBe(58);
    
    // searchNumCandidates = Math.max(150, 58 + 100) = 158
    expect(vectorSearchStage.$vectorSearch.numCandidates).toBe(158);
  });
});
