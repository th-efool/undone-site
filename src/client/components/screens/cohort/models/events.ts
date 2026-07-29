export enum EventStatus {
  Upcoming = 'upcoming',
  Live = 'live',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export type EventPlatform = 'Google Meet' | 'Flow Club' | 'Discord' | 'Zoom';

export interface EventFilter {
  id: string;
  label: string;
  active?: boolean;
}
export interface EventAvatar {
  id: string;
  avatarUrl: string;
}
export interface EventDate {
  month: string;
  day: string;
  weekday: string;
}
export interface EventItem {
  id: string;
  date: EventDate;
  title: string;
  description: string;
  avatars: EventAvatar[];
  attendeeCount: string;
  time: string;
  timezone: string;
  platform: EventPlatform;
  status: EventStatus;
}
export interface WeeklyEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  icon: string;
}
export interface CalendarSyncAction {
  id: string;
  label: string;
  icon: string;
}
export interface EventsCta {
  title: string;
  description: string;
  buttonLabel: string;
  illustration: string;
}
export interface CohortEvents {
  title: string;
  description: string;
  filters: EventFilter[];
  upcomingEvents: EventItem[];
  weeklySchedule: WeeklyEvent[];
  calendarSync: CalendarSyncAction[];
  suggestEvent: EventsCta;
}
