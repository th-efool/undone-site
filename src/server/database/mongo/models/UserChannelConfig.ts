import mongoose, { Schema, Document, Model } from 'mongoose';

// Channel IDs matching the client ChannelHub CHANNELS array
export type ChannelId = 'spark' | 'explore' | 'build' | 'listen' | 'deep_dive' | 'quick';

export interface IUserChannelConfig extends Document {
  userId: string;
  activeChannel: ChannelId;
  // Flat map: "channelId_controlId" -> optionId
  // e.g. { "spark_novelty": "esoteric", "build_scope": "micro" }
  prefs: Record<string, string>;
  updatedAt: Date;
}

const UserChannelConfigSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  activeChannel: {
    type: String,
    enum: ['spark', 'explore', 'build', 'listen', 'deep_dive', 'quick'],
    default: 'quick',
  },
  // Map type in Mongoose stores key-value pairs efficiently
  prefs: { type: Map, of: String, default: {} },
}, {
  timestamps: true,
  collection: 'user_channel_configs',
});

export const UserChannelConfig: Model<IUserChannelConfig> =
  mongoose.models.UserChannelConfig ||
  mongoose.model<IUserChannelConfig>('UserChannelConfig', UserChannelConfigSchema);
