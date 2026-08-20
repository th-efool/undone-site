import { cohortRepo, CreateCohortParams } from '@/src/server/infrastructure/db/postgres/repositories/cohort.repo';
import { CohortTranscript } from '@/src/server/database/mongo/models/CohortTranscript';
import { transcriptCoherenceService } from './transcript-coherence.service';

export class CohortService {
  /**
   * Publishes a cohort, splitting transcripts, saving to MongoDB, 
   * and handling vectorization jobs.
   */
  static async publishCohort(payload: CreateCohortParams, options?: { transcripts?: string[] }) {
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

      // Very rudimentary chunking: split by roughly 1000 characters for demo purposes
      const parts = text.match(/.{1,1000}/g) || [];
      chunks.push(...parts);
    }

    if (!allVectorizable && !payload.forcePublishWithWeights) {
      throw new Error('WEIGHTS_REQUIRED');
    }

    // 3. Save transcript chunks to MongoDB
    // await connectToMongo(); // Ensure connection is active if needed
    const transcriptDoc = await CohortTranscript.create({
      cohortId: cohort.id,
      chunks,
      vectorEmbedding: [],
      isVectorizable: allVectorizable,
      isPublished: false, // Initially false to handle abandoned states
    });

    // 4. Set isPublished = true upon successful save
    const publishedCohort = await cohortRepo.updatePublishStatus(cohort.id, true);
    
    // Also update Mongo document to published
    transcriptDoc.isPublished = true;
    await transcriptDoc.save();

    // 5. Trigger Async Background Job for Vector Embeddings (Commented out)
    // TODO: Trigger background job (e.g., via Inngest or BullMQ) to vectorise the chunks
    // await inngest.send({
    //   name: 'cohort.vectorize',
    //   data: { cohortId: cohort.id, transcriptId: transcriptDoc._id },
    // });

    return publishedCohort;
  }
}

export const cohortService = new CohortService();
