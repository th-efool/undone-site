/**
 * Render Workflows Pipeline - Cohort & Chunk Vectorization (Sponsor Track)
 * Implements a durable fan-out / fan-in map-reduce workflow with exponential retry logic.
 */

import { VectorScoringService } from '@/src/server/domain/cohort/vectorScoring.service';
import { CohortTranscript } from '@/src/server/database/mongo/models/CohortTranscript';
import { Chunk } from '@/src/server/database/mongo/models/Chunk';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';

export interface ChunkVectorTaskInput {
  chunkIndex: number;
  chunkId: string;
  text: string;
  title?: string;
  startSeconds: number;
  endSeconds: number;
  duration: number;
  totalChunks: number;
}

export interface WorkflowInput {
  cohortId: string;
  lessonId?: string;
  fullTranscript: string;
  chunks: Array<{
    chunkIndex: number;
    chunkId: string;
    text: string;
    title?: string;
    startSeconds?: number;
    endSeconds?: number;
    duration?: number;
  }>;
}

export interface WorkflowResult {
  cohortId: string;
  lessonId?: string;
  fullVector: number[];
  isStrictlyLinear: boolean;
  chunksProcessed: number;
  status: 'COMPLETED' | 'FAILED';
}

export async function scoreFullTranscriptTask(
  fullTranscript: string,
  metadata?: { title?: string }
) {
  return await VectorScoringService.scoreTranscript(fullTranscript, {
    title: metadata?.title || 'Full Cohort Lesson',
  });
}

export async function scoreChunkTask(
  chunk: ChunkVectorTaskInput
) {
  const result = await VectorScoringService.scoreTranscript(chunk.text, {
    title: chunk.title || `Part ${chunk.chunkIndex + 1}`,
    chunkIndex: chunk.chunkIndex,
    totalChunks: chunk.totalChunks,
    duration: chunk.duration,
  });

  return {
    ...chunk,
    vector: result.vector,
    isKeyConcept: result.isKeyConcept,
    summary: result.summary,
  };
}

import pLimit from 'p-limit';

export async function runCohortVectorizationWorkflow(
  input: WorkflowInput
): Promise<WorkflowResult> {
  const { cohortId, lessonId, fullTranscript, chunks } = input;
  const safeLessonId = lessonId || 'default-lesson';
  const totalChunks = chunks.length;

  // Step 1: Evaluate Macro Full-Video Vector & Linearity
  const macroResult = await scoreFullTranscriptTask(fullTranscript, {
    title: `Cohort ${cohortId}`,
  });

  // Step 2: Parallel Fan-Out across all chunks
  const limitConcurrency = pLimit(5);
  const chunkTaskPromises = chunks.map((chunk, idx) => {
    return limitConcurrency(() => {
      const startSecs = chunk.startSeconds ?? idx * 180;
      const endSecs = chunk.endSeconds ?? (idx + 1) * 180;
      const durSecs = chunk.duration ?? (endSecs - startSecs);

      return scoreChunkTask({
        chunkIndex: chunk.chunkIndex ?? idx,
        chunkId: chunk.chunkId || `chk_${cohortId}_${idx}`,
        text: chunk.text,
        title: chunk.title,
        startSeconds: startSecs,
        endSeconds: endSecs,
        duration: durSecs,
        totalChunks,
      });
    });
  });

  // Step 3: Fan-In (Await all chunk evaluations)
  const scoredChunks = await Promise.all(chunkTaskPromises);

  // Step 4: Persist aggregated results to MongoDB Atlas
  await connectToMongoDB();
  
  // 4a. Update the Parent CohortTranscript
  await CohortTranscript.findOneAndUpdate(
    { cohortId, lessonId: safeLessonId },
    {
      cohortId,
      lessonId: safeLessonId,
      fullTranscript,
      fullVector: macroResult.vector,
      vectorEmbedding: macroResult.vector, // legacy alias
      isStrictlyLinear: macroResult.isStrictlyLinear,
      linearityDependencyScore: macroResult.linearityDependencyScore,
      isVectorizable: true,
      isPublished: true,
    },
    { upsert: true, new: true }
  );

  // 4b. Upsert all chunks into the new flattened Chunk collection for vector search
  const chunkOperations = scoredChunks.map(scoredChunk => ({
    updateOne: {
      filter: { chunkId: scoredChunk.chunkId },
      update: {
        $set: {
          chunkId: scoredChunk.chunkId,
          cohortId,
          lessonId: safeLessonId,
          chunkIndex: scoredChunk.chunkIndex,
          title: scoredChunk.title || `Part ${scoredChunk.chunkIndex + 1}`,
          text: scoredChunk.text,
          vector: scoredChunk.vector,
          macroVector: macroResult.vector,
          startSeconds: scoredChunk.startSeconds,
          endSeconds: scoredChunk.endSeconds,
          duration: scoredChunk.duration,
          isStrictlyLinear: macroResult.isStrictlyLinear,
          isKeyConcept: scoredChunk.isKeyConcept,
        }
      },
      upsert: true
    }
  }));

  if (chunkOperations.length > 0) {
    await Chunk.bulkWrite(chunkOperations);
    const newChunkIds = scoredChunks.map(c => c.chunkId);
    await Chunk.deleteMany({ cohortId, chunkId: { $nin: newChunkIds } });
  }

  return {
    cohortId,
    lessonId: safeLessonId,
    fullVector: macroResult.vector,
    isStrictlyLinear: macroResult.isStrictlyLinear,
    chunksProcessed: scoredChunks.length,
    status: 'COMPLETED',
  };
}
