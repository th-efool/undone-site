export interface CreateNotificationInput {
  userId: string;
  actorId?: string | null;
  scopeType: 'channel' | 'conversation' | 'studyroom';
  scopeId: string;
  entityId?: string | null;
  type: 'mention' | 'reply' | 'direct_message' | 'group_message';
  title: string;
  body: string;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  actorId: string | null;
  actorName: string | null;
  actorAvatar: string | null;
  scopeType: string;
  scopeId: string;
  entityId: string | null;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferenceDTO {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  mentionOnly: boolean;
  mutedScopes: string[];
}

export interface PushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}
