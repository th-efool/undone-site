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
    const chunks: Array<{
      text: string;
      title?: string;
      startSeconds?: number;
      endSeconds?: number;
      duration?: number;
    }> = [];
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

      // Default to semantic chunking for articles if chunkingMethod isn't explicitly defined for this index
      const isArticle = lessons[i]?.lessonType === 'ARTICLE';
      const method = payload.sources?.[i]?.chunkingMethod || options?.chunkingMethod || (isArticle ? 'semantic' : 'disabled');
      
      if (method === 'semantic') {
        try {
          const semanticResults = await chunkingService.semanticChunkTranscript(text, duration, {
            title: lessons[i]?.title,
          });
          if (semanticResults && semanticResults.length > 0) {
            chunks.push(...semanticResults.map((r, rIdx) => ({
              text: r.text,
              title: r.title || `Part ${rIdx + 1}`,
              startSeconds: r.start,
              endSeconds: r.end,
              duration: r.end - r.start,
            })));
          } else {
            throw new Error('Empty semantic chunking result');
          }
        } catch (err) {
          console.warn('[CohortService] Semantic chunking failed, defaulting to fixed interval chunking:', err);
          const intervals = chunkingService.fixedIntervalChunking(duration);
          const parts = chunkingService.applyChunkOverlap(intervals, duration, text);
          chunks.push(...parts.map((partText, pIdx) => ({
            text: partText,
            title: `${lessons[i]?.title || 'Lesson'} (Part ${pIdx + 1})`,
            startSeconds: intervals[pIdx]?.start ?? 0,
            endSeconds: intervals[pIdx]?.end ?? duration,
            duration: (intervals[pIdx]?.end ?? duration) - (intervals[pIdx]?.start ?? 0),
          })));
        }
      } else {
        let intervals;
        if (method === 'fixed' || method === 'fixed_interval') {
          intervals = chunkingService.fixedIntervalChunking(duration);
        } else {
          intervals = chunkingService.disabledChunking(duration);
        }

        const parts = chunkingService.applyChunkOverlap(intervals, duration, text);
        chunks.push(...parts.map((partText, pIdx) => ({
          text: partText,
          title: `${lessons[i]?.title || 'Lesson'} (Part ${pIdx + 1})`,
          startSeconds: intervals[pIdx]?.start ?? 0,
          endSeconds: intervals[pIdx]?.end ?? duration,
          duration: (intervals[pIdx]?.end ?? duration) - (intervals[pIdx]?.start ?? 0),
        })));
      }
    }

    if (!allVectorizable && !payload.forcePublishWithWeights) {
      throw new Error('WEIGHTS_REQUIRED');
    }

    // 3. Save transcript chunks and execute vectorization workflow in MongoDB
    await connectToMongoDB();
    try {
      const fullTranscript = transcripts.join('\n\n');
      const structuredChunks = chunks.map((chunkItem, idx) => ({
        chunkIndex: idx,
        chunkId: `chk_${cohort.id}_${idx}`,
        text: chunkItem.text,
        title: chunkItem.title || `Part ${idx + 1}`,
        startSeconds: chunkItem.startSeconds,
        endSeconds: chunkItem.endSeconds,
        duration: chunkItem.duration,
      }));

      // Fire the vectorization workflow.
      // On Render (production): WORKER_URL is set, so we fire-and-forget to the background worker
      // and return immediately. The worker runs the Gemini calls + MongoDB upserts async.
      // Locally (dev): WORKER_URL is not set, so we run inline (slower, but no separate process needed).
      // const workerUrl = process.env.WORKER_URL;
      // const workerSecret = process.env.WORKER_SECRET;

      // if (workerUrl) {
      //   fetch(workerUrl + '/run', {
      //     method: 'POST',
      //     headers: {
      //       'Content-Type': 'application/json',
      //       ...(workerSecret ? { 'Authorization': 'Bearer ' + workerSecret } : {}),
      //     },
      //     body: JSON.stringify({
      //       cohortId: cohort.id,
      //       fullTranscript,
      //       chunks: structuredChunks,
      //     }),
      //   }).catch((err) => console.error('[CohortService] Worker trigger failed:', err));
      // }
      
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
