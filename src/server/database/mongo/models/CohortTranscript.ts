import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChunkVectorItem {
  chunkIndex: number;
  chunkId: string;
  title?: string;
  text: string;
  vector: number[]; // 12-dimensional vector embedding for this chunk
  startSeconds: number; // seconds from video start
  endSeconds: number; // seconds from video start
  duration: number; // seconds
  isKeyConcept?: boolean;
  summary?: string;
}

export interface ICohortTranscript extends Document {
  cohortId: string;
  lessonId?: string;
  fullTranscript?: string;
  chunks: string[]; // Raw chunk text array for backward compatibility
  chunkVectors: IChunkVectorItem[]; // Rich per-chunk vector and timing items
  vectorEmbedding: number[]; // Legacy / alias for fullVector
  fullVector: number[]; // 12D vector embedding for full lesson/video
  isStrictlyLinear: boolean; // true = linear prerequisite enforcement; false = modular discovery
  linearityDependencyScore: number; // 0.0 (modular) to 1.0 (strict prerequisite chain)
  isVectorizable: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChunkVectorItemSchema = new Schema<IChunkVectorItem>(
  {
    chunkIndex: { type: Number, required: true },
    chunkId: { type: String, required: true },
    title: { type: String, trim: true },
    text: { type: String, required: true },
    vector: { type: [Number], default: [] },
    startSeconds: { type: Number, default: 0, min: 0 },
    endSeconds: { type: Number, default: 180, min: 0 },
    duration: { type: Number, default: 180, min: 0 },
    isKeyConcept: { type: Boolean, default: false },
    summary: { type: String, trim: true },
  },
  { _id: false }
);

const CohortTranscriptSchema: Schema = new Schema(
  {
    cohortId: { type: String, required: true, index: true },
    lessonId: { type: String, index: true },
    fullTranscript: { type: String, default: '' },
    chunks: { type: [String], default: [] },
    chunkVectors: { type: [ChunkVectorItemSchema], default: [] },
    vectorEmbedding: { type: [Number], default: [] },
    fullVector: { type: [Number], default: [] },
    isStrictlyLinear: { type: Boolean, default: true },
    linearityDependencyScore: { type: Number, default: 0.5 },
    isVectorizable: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for fast retrieval in /play feed
CohortTranscriptSchema.index({ cohortId: 1, lessonId: 1 });
CohortTranscriptSchema.index({ cohortId: 1, isStrictlyLinear: 1 });

// Prevent mongoose from compiling the model multiple times in Next.js development
export const CohortTranscript: Model<ICohortTranscript> =
  mongoose.models.CohortTranscript ||
  mongoose.model<ICohortTranscript>('CohortTranscript', CohortTranscriptSchema);

