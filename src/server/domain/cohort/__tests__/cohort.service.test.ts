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
    semanticChunkTranscript: vi.fn(),
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

  it('correctly invokes semanticChunkTranscript when chunkingMethod is semantic', async () => {
    vi.mocked(cohortRepo.createCohortWithCommunity).mockResolvedValue({ id: 'semantic-cohort-id' } as any);
    vi.mocked(transcriptCoherenceService.checkTranscriptCoherence).mockResolvedValue(true);
    vi.mocked(chunkingService.semanticChunkTranscript).mockResolvedValue([
      { start: 0, end: 120, text: 'Semantic section 1', title: 'Intro' },
      { start: 120, end: 240, text: 'Semantic section 2', title: 'Core' },
    ]);
    vi.mocked(cohortRepo.updatePublishStatus).mockResolvedValue({ id: 'semantic-cohort-id', isPublished: true } as any);
    vi.mocked(workflow.runCohortVectorizationWorkflow).mockResolvedValue({
      cohortId: 'semantic-cohort-id',
      fullVector: [],
      isStrictlyLinear: false,
      chunksProcessed: 2,
      status: 'COMPLETED',
    });

    const payload = {
      creatorId: 'user1',
      title: 'Semantic Cohort',
      forcePublishWithWeights: true,
      sources: [{ type: 'YOUTUBE_VIDEO' as any, title: 'Video', url: 'https://youtube.com', chunkingMethod: 'semantic' }],
      seasons: [
        {
          title: 'Season 1',
          order: 1,
          lessons: [{ title: 'Lesson 1', duration: 240, order: 1, lessonType: 'VIDEO' as any }]
        }
      ]
    };

    const res = await CohortService.publishCohort(payload as any, { transcripts: ['Full transcript for testing semantic chunking across topics.'] });

    expect(chunkingService.semanticChunkTranscript).toHaveBeenCalledTimes(1);
    expect(workflow.runCohortVectorizationWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      cohortId: 'semantic-cohort-id',
      chunks: [
        expect.objectContaining({ text: 'Semantic section 1', title: 'Intro', startSeconds: 0, endSeconds: 120 }),
        expect.objectContaining({ text: 'Semantic section 2', title: 'Core', startSeconds: 120, endSeconds: 240 }),
      ]
    }));
    expect(res).toEqual({ id: 'semantic-cohort-id', isPublished: true });
  });

  it('gracefully falls back to fixed interval chunking if semanticChunkTranscript throws an error', async () => {
    vi.mocked(cohortRepo.createCohortWithCommunity).mockResolvedValue({ id: 'fallback-cohort-id' } as any);
    vi.mocked(transcriptCoherenceService.checkTranscriptCoherence).mockResolvedValue(true);
    vi.mocked(chunkingService.semanticChunkTranscript).mockRejectedValue(new Error('LLM Rate Limit / Network error'));
    vi.mocked(chunkingService.fixedIntervalChunking).mockReturnValue([{ start: 0, end: 300 }]);
    vi.mocked(chunkingService.applyChunkOverlap).mockReturnValue(['fallback chunk interval text']);
    vi.mocked(cohortRepo.updatePublishStatus).mockResolvedValue({ id: 'fallback-cohort-id', isPublished: true } as any);
    vi.mocked(workflow.runCohortVectorizationWorkflow).mockResolvedValue({
      cohortId: 'fallback-cohort-id',
      fullVector: [],
      isStrictlyLinear: false,
      chunksProcessed: 1,
      status: 'COMPLETED',
    });

    const payload = {
      creatorId: 'user1',
      title: 'Fallback Cohort',
      forcePublishWithWeights: true,
      sources: [{ type: 'YOUTUBE_VIDEO' as any, title: 'Video', url: 'https://youtube.com', chunkingMethod: 'semantic' }],
      seasons: [
        {
          title: 'Season 1',
          order: 1,
          lessons: [{ title: 'Lesson 1', duration: 300, order: 1, lessonType: 'VIDEO' as any }]
        }
      ]
    };

    const res = await CohortService.publishCohort(payload as any, { transcripts: ['Sample transcript text for error fallback test.'] });

    expect(chunkingService.fixedIntervalChunking).toHaveBeenCalledWith(300);
    expect(workflow.runCohortVectorizationWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      cohortId: 'fallback-cohort-id',
      chunks: [
        expect.objectContaining({ text: 'fallback chunk interval text', startSeconds: 0, endSeconds: 300 }),
      ]
    }));
    expect(res).toEqual({ id: 'fallback-cohort-id', isPublished: true });
  });
});


