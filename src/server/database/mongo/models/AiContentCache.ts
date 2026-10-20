import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAiContentCache extends Document {
  contentHash: string;
  operationType: string;
  modelId: string;
  payload: any;
  inputByteLength: number;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

const AiContentCacheSchema: Schema = new Schema(
  {
    contentHash: { type: String, required: true },
    operationType: { type: String, required: true },
    modelId: { type: String, required: true, default: 'default' },
    payload: { type: Schema.Types.Mixed, required: true },
    inputByteLength: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    lastAccessedAt: { type: Date, default: Date.now },
    accessCount: { type: Number, default: 1 },
  },
  {
    collection: 'ai_content_cache',
  }
);

AiContentCacheSchema.index({ contentHash: 1 }, { unique: true });
AiContentCacheSchema.index({ operationType: 1, createdAt: -1 });
AiContentCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const AiContentCache: Model<IAiContentCache> =
  mongoose.models.AiContentCache ||
  mongoose.model<IAiContentCache>('AiContentCache', AiContentCacheSchema);
