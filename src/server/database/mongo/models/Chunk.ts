import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChunk extends Document {
  chunkId: string;
  cohortId: string;
  lessonId: string;
  chunkIndex: number;
  title: string;
  text: string;
  vector: number[];         // 12D Micro Vector
  macroVector: number[];    // 12D Macro Vector
  startSeconds: number;
  endSeconds: number;
  duration: number;
  isStrictlyLinear: boolean;
  isKeyConcept: boolean;
  createdAt: Date;
}

const ChunkSchema: Schema = new Schema({
  chunkId: { type: String, required: true, unique: true, index: true },
  cohortId: { type: String, required: true, index: true },
  lessonId: { type: String, required: true, index: true },
  chunkIndex: { type: Number, required: true },
  title: { type: String, required: true },
  text: { type: String, required: true },
  vector: { type: [Number], required: true },
  macroVector: { type: [Number], required: true },
  startSeconds: { type: Number, required: true },
  endSeconds: { type: Number, required: true },
  duration: { type: Number, required: true },
  isStrictlyLinear: { type: Boolean, required: true, default: false },
  isKeyConcept: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'chunks'
});

// We assume the Atlas Vector Search index named "vector_index" 
// will be created on the `vector` field in MongoDB Atlas.
// Indexing standard fields for quick lookup
ChunkSchema.index({ cohortId: 1, lessonId: 1, chunkIndex: 1 });

export const Chunk: Model<IChunk> = 
  mongoose.models.Chunk || mongoose.model<IChunk>('Chunk', ChunkSchema);
