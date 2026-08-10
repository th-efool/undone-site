import type { AvatarPreview } from './explore';

export interface SideQuest {
  id: string;
  cohortId?: string;

  title: string;

  subtitle: string;

  dailyGoal: string;

  thumbnail: string;

  featuredParticipants: AvatarPreview[];

  participantCount: string;
}
