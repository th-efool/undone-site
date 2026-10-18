import mongoose, { Schema, Document, Model } from 'mongoose';

export const VALID_FREQUENCIES = [
  'Very Often',
  'Often',
  'Sometimes',
  'Rarely',
  'Very Rarely',
] as const;
export type CohortFrequency = (typeof VALID_FREQUENCIES)[number];

export const VALID_ORDER_STYLES = [
  'Sequential',
  'Semantic Randomize',
  'Randomize',
] as const;
export type CohortOrderStyle = (typeof VALID_ORDER_STYLES)[number];

export const VALID_SCHEDULE_DAYS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;
export type ScheduleDay = (typeof VALID_SCHEDULE_DAYS)[number];

export interface IUserCohortConfig extends Document {
  userId: string;
  cohortId: string;
  rank: number;
  dailyGoalMinutes: number;
  scheduleDays: ScheduleDay[];
  scheduleLabel: string;
  frequency: CohortFrequency;
  orderStyle: CohortOrderStyle;
  isPaused: boolean;
  isHidden: boolean;
  pausedUntil?: Date;
  pausedReason?: string;
  updatedAt: Date;
}

const UserCohortConfigSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  cohortId: { type: String, required: true, index: true },
  rank: { type: Number, default: 0, min: 0 },
  dailyGoalMinutes: {
    type: Number,
    default: 20,
    min: [1, 'Daily goal must be at least 1 minute'],
    max: [1440, 'Daily goal cannot exceed 1440 minutes (24 hours)'],
  },
  scheduleDays: {
    type: [String],
    enum: VALID_SCHEDULE_DAYS,
    default: ['Mon', 'Wed', 'Fri'],
  },
  scheduleLabel: { type: String, default: 'Mon, Wed, Fri', maxlength: 100 },
  frequency: {
    type: String,
    enum: VALID_FREQUENCIES,
    default: 'Often',
  },
  orderStyle: {
    type: String,
    enum: VALID_ORDER_STYLES,
    default: 'Sequential',
  },
  isPaused: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  pausedUntil: { type: Date },
  pausedReason: { type: String, maxlength: 500, trim: true },
}, {
  timestamps: true,
  collection: 'user_cohort_configs',
});

// Primary read key: all configs for a user in one query
UserCohortConfigSchema.index({ userId: 1, cohortId: 1 }, { unique: true });

export const UserCohortConfig: Model<IUserCohortConfig> =
  mongoose.models.UserCohortConfig ||
  mongoose.model<IUserCohortConfig>('UserCohortConfig', UserCohortConfigSchema);
