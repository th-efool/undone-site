import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserChunkProgress extends Document {
  userId: string;
  chunkId: string;
  lessonId: string;
  cohortId: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  watchedSeconds: number;
  totalSeconds: number;
  lastWatchedAt: Date;
  completedAt?: Date;
  bookmarked: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserChunkProgressSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  chunkId: { type: String, required: true, index: true },
  lessonId: { type: String, required: true, index: true },
  cohortId: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
    default: 'NOT_STARTED'
  },
  watchedSeconds: { type: Number, default: 0 },
  totalSeconds: { type: Number, default: 0 },
  lastWatchedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  bookmarked: { type: Boolean, default: false },
  notes: { type: String }
}, {
  timestamps: true,
  collection: 'user_chunk_progress'
});

// Compound index to quickly find a specific chunk for a user
UserChunkProgressSchema.index({ userId: 1, chunkId: 1 }, { unique: true });
// Compound index to quickly find all completed chunks for a user
UserChunkProgressSchema.index({ userId: 1, status: 1 });

export const UserChunkProgress: Model<IUserChunkProgress> = 
  mongoose.models.UserChunkProgress || mongoose.model<IUserChunkProgress>('UserChunkProgress', UserChunkProgressSchema);
