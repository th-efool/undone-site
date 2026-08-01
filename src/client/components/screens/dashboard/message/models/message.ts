export type SidebarTab = 'community' | 'dm';
export type ConversationFilter = 'all' | 'unread' | 'mentions' | 'pinned';

export interface PersonPreview {
  id: string;
  name: string;
  avatar: string;
  online?: boolean;
}

export interface ConversationPreview {
  id: string;
  kind: SidebarTab;
  name: string;
  avatar: string;
  sender: string;
  preview: string;
  timestamp: string;
  onlineCount?: number;
  statusLabel?: string;
  unreadCount?: number;
  hasMention?: boolean;
  pinned?: boolean;
  selected?: boolean;
  mutedUntil?: number | null; // Batch A
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

export interface RecentMessage {
  id: string;
  sender: PersonPreview;
  community: string;
  message: string;
  timestamp: string;
  unreadCount?: number;
  attachment?: string;
  live?: boolean;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  subtitle: string;
  startsIn: string;
  tone: 'purple' | 'orange' | 'blue';
}

export interface ChallengeCard {
  tag: string;
  title: string;
  description: string;
  participants: PersonPreview[];
  participantCount: number;
}

export interface MessageMock {
  conversations: ConversationPreview[];
  liveSessions: LiveSession[];
  recentMessages: RecentMessage[];
  upcomingEvents: UpcomingEvent[];
  challenge: ChallengeCard;
  friendsOnline: PersonPreview[];
}

export type MessageView = 'landing' | 'community' | 'dm';
export type ChatAttachmentKind = 'image' | 'pdf' | 'file' | 'video' | 'audio';

export interface ChatReaction {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
}

export interface ChatAttachment {
  id: string;
  kind: ChatAttachmentKind;
  title: string;
  url?: string;
  caption?: string;
  meta?: string;
  duration?: string;
}

export interface ReplyPreviewModel {
  avatars: PersonPreview[];
  count: number;
  lastReplyBy: string;
  timestamp: string;
}

export interface CommunityMessage {
  id: string;
  author: PersonPreview;
  badge?: string;
  timestamp: string;
  body?: string;
  attachment?: ChatAttachment;
  reactions?: ChatReaction[];
  replies?: ReplyPreviewModel;
  /** Batch D1: Optional date label for grouping (e.g. "Today", "Yesterday") */
  dateLabel?: string;
}

export type ChannelTab = { id: string; label: string; unreadCount?: number };

export interface PinnedAnnouncement {
  author: string;
  title: string;
  actionLabel: string;
}

export interface PinnedMessage {
  id: string;
  author: PersonPreview;
  preview: string;
  timestamp: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  subtitle: string;
  startsIn: string;
}

export interface CommunityChatModel {
  id: string;
  name: string;
  avatar: string;
  description: string;
  onlineCount: number;
  createdBy: string;
  createdAt: string;
  members: PersonPreview[];
  channels: ChannelTab[];
  selectedChannel: string;
  pinnedAnnouncement: PinnedAnnouncement;
  messages: CommunityMessage[];
  pinnedMessages: PinnedMessage[];
  media: ChatAttachment[];
  events: CommunityEvent[];
}

export type DMMessageType = 'incoming' | 'outgoing';
export type DMMessageStatus = 'sent' | 'delivered' | 'read';

export interface DMUser {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  role: string;
  company: string;
  bio: string;
}

export interface DMReaction {
  emoji: string;
  count: number;
}

export interface DMMessage {
  id: string;
  type: DMMessageType;
  text: string;
  timestamp: string;
  status?: DMMessageStatus;
  reactions?: DMReaction[];
  tail?: boolean;
  showAvatar?: boolean;
  dateLabel?: string;
  attachment?: ChatAttachment;
  replyTo?: string;
}

export interface DMResource {
  id: string;
  title: string;
  count: number;
  icon: 'files' | 'pin' | 'media' | 'links';
}

export interface DMNotificationSettings {
  enabled: boolean;
}

export interface DMConversationModel {
  id: string;
  user: DMUser;
  messages: DMMessage[];
  resources: DMResource[];
  notifications: DMNotificationSettings;
}

/** Reply-to-message inline banner context (Batch C) */
export interface ReplyContext {
  messageId: string;
  senderName: string;
  previewText: string;
}
