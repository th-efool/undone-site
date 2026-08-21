import { cohortRepo, CreateCohortParams } from '@/src/server/infrastructure/db/postgres/repositories/cohort.repo';
import { CohortTranscript } from '@/src/server/database/mongo/models/CohortTranscript';
import { transcriptCoherenceService } from './transcript-coherence.service';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { chunkingService } from './chunking.service';

export class CohortService {
  /**
   * Publishes a cohort, splitting transcripts, saving to MongoDB, 
   * and handling vectorization jobs.
   */
  static async publishCohort(payload: CreateCohortParams, options?: { transcripts?: string[], chunkingMethod?: 'semantic' | 'disabled' | 'fixed' }) {
    // 1. Create cohort in Postgres (initially isPublished = false)
    const cohort = await cohortRepo.createCohortWithCommunity({
      ...payload,
      isPublished: false,
    });

    // 2. Chunking logic (mocking transcripts if none provided)
    const transcripts = options?.transcripts && options.transcripts.length > 0 
      ? options.transcripts 
      : ['This is a mocked transcript for chunking. It contains placeholder text.'];

    // Basic sentence/character chunking strategy
    const chunks: string[] = [];
    let allVectorizable = true;

    // Get flat list of durations from payload seasons
    const lessons = payload.seasons?.flatMap(s => s.lessons) || [];

    for (let i = 0; i < transcripts.length; i++) {
      const text = transcripts[i];
      const duration = lessons[i]?.duration || 0;
      
      const isCoherent = await transcriptCoherenceService.checkTranscriptCoherence(text);
      let isVectorizable = true;

      if (!isCoherent) {
        isVectorizable = false;
      } else {
        if (!text) {
          isVectorizable = false;
        } else {
          const wordCount = text.trim().split(/\s+/).length;
          const durationInMinutes = duration / 60;
          const wpm = durationInMinutes > 0 ? wordCount / durationInMinutes : 0;
          
          if (wpm < 50) {
            isVectorizable = false;
          }
        }
      }

      if (!isVectorizable) {
        allVectorizable = false;
      }

      let intervals;
      const method = payload.sources?.[i]?.chunkingMethod || options?.chunkingMethod || 'disabled';
      if (method === 'semantic') {
        intervals = chunkingService.semanticChunking(duration);
      } else if (method === 'fixed' || method === 'fixed_interval') {
        intervals = chunkingService.fixedIntervalChunking(duration);
      } else {
        intervals = chunkingService.disabledChunking(duration);
      }

      const parts = chunkingService.applyChunkOverlap(intervals, duration, text);
      chunks.push(...parts);
    }

    if (!allVectorizable && !payload.forcePublishWithWeights) {
      throw new Error('WEIGHTS_REQUIRED');
    }

    // 3. Save transcript chunks and execute vectorization workflow in MongoDB
    await connectToMongoDB();
    try {
      const fullTranscript = transcripts.join('\n\n');
      const structuredChunks = chunks.map((chunkText, idx) => ({
        chunkIndex: idx,
        chunkId: `chk_${cohort.id}_${idx}`,
        text: chunkText,
        title: `Part ${idx + 1}`,
      }));

      // Execute durable vectorization workflow
      const { runCohortVectorizationWorkflow } = await import(
        '@/src/server/infrastructure/workflows/cohortVectorizationWorkflow'
      );

      await runCohortVectorizationWorkflow({
        cohortId: cohort.id,
        fullTranscript,
        chunks: structuredChunks,
      });

      // 4. Set isPublished = true in Postgres upon successful save & vectorization
      const publishedCohort = await cohortRepo.updatePublishStatus(cohort.id, true);

      return publishedCohort;
    } catch (error) {
      await prisma.cohort.delete({ where: { id: cohort.id } });
      throw error;
    }
  }
}

export const cohortService = new CohortService();
