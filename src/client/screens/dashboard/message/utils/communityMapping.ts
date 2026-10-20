import type { EnrolledCommunityDTO, CanonicalMessagePayload } from '@/src/client/repositories/messagesRepository';
import type {
  CommunityChatModel,
  CommunityMessage,
  ConversationPreview,
  UpcomingEvent,
} from '../models';

export function formatMessageTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '';
  }
}

export function formatMessageDateLabel(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Today';

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Yesterday';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(date);
  } catch {
    return 'Today';
  }
}

export function mapCanonicalMessageToCommunityMessage(
  msg: CanonicalMessagePayload,
  currentUserId?: string | null,
  status: 'sending' | 'sent' | 'failed' = 'sent'
): CommunityMessage {
  const isMe = Boolean(currentUserId && msg.author.id === currentUserId);
  const isDeleted = Boolean(msg.deletedAt);
  const isEdited = Boolean(msg.editedAt && !isDeleted);

  return {
    id: msg.id,
    body: msg.content,
    badge: isDeleted ? 'deleted' : isEdited ? 'edited' : undefined,
    timestamp: formatMessageTime(msg.createdAt),
    dateLabel: formatMessageDateLabel(msg.createdAt),
    author: {
      id: isMe ? (currentUserId || 'me') : msg.author.id,
      name: isMe ? 'You' : (msg.author.name || msg.author.username || 'Member'),
      avatar: msg.author.image || '/undone-logo.svg',
      online: false,
    },
    status,
    messageSequence: msg.messageSequence,
    reactions: msg.reactions?.map((r) => ({
      emoji: r.emoji,
      count: r.count,
      reactedByMe: r.reactedByMe,
    })) || [],
    replyTo: msg.replyTo
      ? {
          messageId: msg.replyTo.id,
          authorName: msg.replyTo.authorName || 'Replied message',
          authorAvatar: msg.replyTo.authorAvatar || '/undone-logo.svg',
          previewText: msg.replyTo.content,
        }
      : msg.replyToId
      ? {
          messageId: msg.replyToId,
          authorName: 'Replied message',
          authorAvatar: '/undone-logo.svg',
          previewText: '',
        }
      : undefined,
  };
}

export function mapCommunityDtoToConversationPreview(
  dto: EnrolledCommunityDTO,
  selected = false
): ConversationPreview {
  return {
    id: dto.cohortId,
    kind: 'community',
    name: dto.cohortTitle,
    avatar: dto.coverImage || '/undone-logo.svg',
    sender: dto.cohortTitle,
    preview: dto.chatEnabled
      ? (dto.channels.length > 0 ? `#${dto.channels[0].name}` : 'Community chat')
      : 'Chat disabled',
    timestamp: '',
    selected,
  };
}

export function mapCommunityDtoToCommunityChat(
  dto: EnrolledCommunityDTO,
  selectedChannelId?: string
): CommunityChatModel {
  const channels = dto.channels.map((ch) => ({
    id: ch.id,
    label: `# ${ch.name}`,
  }));

  const activeChannelId =
    selectedChannelId && dto.channels.some((c) => c.id === selectedChannelId)
      ? selectedChannelId
      : (dto.channels[0]?.id || '');

  return {
    id: dto.cohortId,
    name: dto.cohortTitle,
    avatar: dto.coverImage || '/undone-logo.svg',
    description: dto.chatEnabled
      ? `${dto.cohortTitle} Community`
      : 'Community chat is currently disabled',
    onlineCount: 0,
    createdBy: dto.cohortTitle,
    createdAt: '',
    members: [],
    channels,
    selectedChannel: activeChannelId,
    pinnedAnnouncement: {
      author: '',
      title: '',
      actionLabel: '',
    },
    messages: [],
    pinnedMessages: [],
    media: [],
    events: [],
  };
}

// Fallback compatibility helpers (no mock imports)
export function getMessageCohorts(): EnrolledCommunityDTO[] {
  return [];
}

export function mapCohortToConversation(cohort: EnrolledCommunityDTO, selected = false): ConversationPreview {
  return mapCommunityDtoToConversationPreview(cohort, selected);
}

export function mapCohortToCommunity(cohortId: string | null): CommunityChatModel {
  return {
    id: cohortId || '',
    name: 'Community',
    avatar: '/undone-logo.svg',
    description: '',
    onlineCount: 0,
    createdBy: '',
    createdAt: '',
    members: [],
    channels: [],
    selectedChannel: '',
    pinnedAnnouncement: { author: '', title: '', actionLabel: '' },
    messages: [],
    pinnedMessages: [],
    media: [],
    events: [],
  };
}

export function mapCohortToUpcomingEvent(_cohort: unknown, _offset: number): UpcomingEvent {
  return {
    id: '',
    title: '',
    subtitle: '',
    startsIn: '',
    tone: 'blue',
  };
}
