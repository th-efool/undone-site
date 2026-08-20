import mongoose, { Schema, Document } from 'mongoose';

export interface ICohortTranscript extends Document {
  cohortId: string;
  chunks: string[];
  vectorEmbedding: number[];
  isVectorizable: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CohortTranscriptSchema: Schema = new Schema(
  {
    cohortId: { type: String, required: true, index: true },
    chunks: { type: [String], default: [] },
    vectorEmbedding: { type: [Number], default: [] },
    isVectorizable: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Prevent mongoose from compiling the model multiple times in Next.js development
export const CohortTranscript = mongoose.models.CohortTranscript || mongoose.model<ICohortTranscript>('CohortTranscript', CohortTranscriptSchema);
