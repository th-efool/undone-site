import type { AvatarPreview } from './explore';

export type ContentProvider = 'youtube' | 'vimeo' | 'loom';

export interface TrendingCourse {
  id: string;
  cohortId?: string;
  title: string;
  provider: ContentProvider;
  thumbnail: string;
  durationLabel: string;
  featuredLearners: AvatarPreview[];
  learnerCount: string;
  rating: number;
}
