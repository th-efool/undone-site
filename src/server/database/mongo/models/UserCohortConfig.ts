import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserCohortConfig extends Document {
  userId: string;
  cohortId: string;
  rank: number;
  dailyGoalMinutes: number;
  scheduleDays: string[];
  scheduleLabel: string;
  frequency: 'Very Often' | 'Often' | 'Sometimes' | 'Rarely' | 'Very Rarely';
  orderStyle: 'Sequential' | 'Semantic Randomize' | 'Randomize';
  isPaused: boolean;
  pausedUntil?: Date;
  pausedReason?: string;
  updatedAt: Date;
}

const UserCohortConfigSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  cohortId: { type: String, required: true, index: true },
  rank: { type: Number, default: 0 },
  dailyGoalMinutes: { type: Number, default: 20 },
  scheduleDays: { type: [String], default: ['Mon', 'Wed', 'Fri'] },
  scheduleLabel: { type: String, default: 'Mon, Wed, Fri' },
  frequency: {
    type: String,
    enum: ['Very Often', 'Often', 'Sometimes', 'Rarely', 'Very Rarely'],
    default: 'Often',
  },
  orderStyle: {
    type: String,
    enum: ['Sequential', 'Semantic Randomize', 'Randomize'],
    default: 'Sequential',
  },
  isPaused: { type: Boolean, default: false },
  pausedUntil: { type: Date },
  pausedReason: { type: String },
}, {
  timestamps: true,
  collection: 'user_cohort_configs',
});

// Primary read key: all configs for a user in one query
UserCohortConfigSchema.index({ userId: 1, cohortId: 1 }, { unique: true });

export const UserCohortConfig: Model<IUserCohortConfig> =
  mongoose.models.UserCohortConfig ||
  mongoose.model<IUserCohortConfig>('UserCohortConfig', UserCohortConfigSchema);
