export class TranscriptCoherenceService {
  async checkTranscriptCoherence(transcript: string): Promise<boolean> {
    return true; // Always return true for now as per plan
  }
}

export const transcriptCoherenceService = new TranscriptCoherenceService();
