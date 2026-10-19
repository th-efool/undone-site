// Shared dashboard-wide types extracted from message models
export interface PersonPreview {
  id: string;
  name: string;
  avatar: string;
  online?: boolean;
}

export interface LiveSession {
  id: string;
  title: string;
  thumbnail: string;
  avatars: PersonPreview[];
  status: string;
  onlineCount: number;
  speakingCount?: number;
  live?: boolean;
  primary?: boolean;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  subtitle: string;
  startsIn: string;
  tone: 'purple' | 'orange' | 'blue';
}
