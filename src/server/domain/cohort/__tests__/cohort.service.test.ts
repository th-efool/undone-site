import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CohortService } from '../cohort.service';
import { cohortRepo } from '@/src/server/infrastructure/db/postgres/repositories/cohort.repo';
import { transcriptCoherenceService } from '../transcript-coherence.service';
import { chunkingService } from '../chunking.service';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import * as workflow from '@/src/server/infrastructure/workflows/cohortVectorizationWorkflow';

vi.mock('@/src/server/infrastructure/db/postgres/repositories/cohort.repo', () => ({
  cohortRepo: {
    createCohortWithCommunity: vi.fn(),
    updatePublishStatus: vi.fn(),
  },
}));

vi.mock('../transcript-coherence.service', () => ({
  transcriptCoherenceService: {
    checkTranscriptCoherence: vi.fn(),
  },
}));

vi.mock('../chunking.service', () => ({
  chunkingService: {
    semanticChunking: vi.fn(),
    fixedIntervalChunking: vi.fn(),
    disabledChunking: vi.fn(),
    applyChunkOverlap: vi.fn(),
  },
}));

vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({
  connectToMongoDB: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohort: {
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/src/server/infrastructure/workflows/cohortVectorizationWorkflow', () => ({
  runCohortVectorizationWorkflow: vi.fn(),
}));

describe('CohortService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('successfully calls inline runCohortVectorizationWorkflow and DOES NOT attempt to fetch worker URL, even if process.env.WORKER_URL is set', async () => {
    process.env.WORKER_URL = 'http://mock-worker-url';

    const fetchSpy = vi.spyOn(global, 'fetch');

    // Mock implementations
    vi.mocked(cohortRepo.createCohortWithCommunity).mockResolvedValue({ id: 'test-cohort-id' } as any);
    vi.mocked(transcriptCoherenceService.checkTranscriptCoherence).mockResolvedValue(true);
    vi.mocked(chunkingService.disabledChunking).mockReturnValue([]);
    vi.mocked(chunkingService.applyChunkOverlap).mockReturnValue(['chunk1', 'chunk2']);
    vi.mocked(cohortRepo.updatePublishStatus).mockResolvedValue({ id: 'test-cohort-id', isPublished: true } as any);
    vi.mocked(workflow.runCohortVectorizationWorkflow).mockResolvedValue({
      cohortId: 'test-cohort-id',
      fullVector: [],
      isStrictlyLinear: false,
      chunksProcessed: 2,
      status: 'COMPLETED',
    });

    const payload = {
      creatorId: 'user1',
      title: 'Test Cohort',
      forcePublishWithWeights: true,
      categories: [],
      tags: [],
      requirements: [],
      learningOutcomes: [],
      sources: [],
      seasons: [
        {
          title: 'Season 1',
          orderIndex: 0,
          lessons: [
            {
              title: 'Lesson 1',
              orderIndex: 0,
              duration: 300,
              lessonType: 'VIDEO' as any
            }
          ]
        }
      ]
    };

    const result = await CohortService.publishCohort(payload as any, { transcripts: ['Test transcript with enough words to pass wpm test so it does not fail. I need to add more words here to ensure it has over 50 words per minute. Since duration is 300s (5m), wpm needs to be > 50, which means 250 words total. This might be annoying. Let me mock forcePublishWithWeights to bypass this logic.'] });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(workflow.runCohortVectorizationWorkflow).toHaveBeenCalledTimes(1);
    expect(workflow.runCohortVectorizationWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      cohortId: 'test-cohort-id',
      fullTranscript: expect.any(String),
      chunks: expect.any(Array),
    }));
    expect(result).toEqual({ id: 'test-cohort-id', isPublished: true });
    
    fetchSpy.mockRestore();
  });

  it('forces publish without wpm requirement if forcePublishWithWeights is true', async () => {
    process.env.WORKER_URL = 'http://mock-worker-url';
    const fetchSpy = vi.spyOn(global, 'fetch');

    vi.mocked(cohortRepo.createCohortWithCommunity).mockResolvedValue({ id: 'test-cohort-id' } as any);
    vi.mocked(transcriptCoherenceService.checkTranscriptCoherence).mockResolvedValue(true);
    vi.mocked(chunkingService.disabledChunking).mockReturnValue([]);
    vi.mocked(chunkingService.applyChunkOverlap).mockReturnValue(['chunk1', 'chunk2']);
    vi.mocked(cohortRepo.updatePublishStatus).mockResolvedValue({ id: 'test-cohort-id', isPublished: true } as any);

    const payload = {
      creatorId: 'user1',
      title: 'Test Cohort',
      forcePublishWithWeights: true,
      categories: [],
      tags: [],
      requirements: [],
      learningOutcomes: [],
      sources: [],
    };

    await CohortService.publishCohort(payload as any, { transcripts: ['short text'] });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(workflow.runCohortVectorizationWorkflow).toHaveBeenCalledTimes(1);
    
    fetchSpy.mockRestore();
  });
});
