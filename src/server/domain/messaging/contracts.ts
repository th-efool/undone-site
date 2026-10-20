import { createHash } from 'node:crypto';

export interface AuthorSummary {
  id: string;
  name: string | null;
  image: string | null;
  username: string | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
}

export interface CanonicalMessagePayload {
  id: string;
  content: string;
  channelId: string;
  authorId: string;
  messageSequence: number;
  clientRequestId?: string | null;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    authorName: string | null;
    authorAvatar: string | null;
  } | null;
  revision: number;
  editedAt?: string | null;
  deletedAt?: string | null;
  deletionReason?: string | null;
  reactions?: ReactionSummary[];
  createdAt: string;
  updatedAt: string;
  author: AuthorSummary;
}

export interface RealtimeEventEnvelope<T = unknown> {
  eventId: string;
  schemaVersion: number;
  type: string;
  streamId: string;
  sequence: number;
  generation: number;
  occurredAt: string;
  entityId?: string | null;
  entityRevision?: number | null;
  clientRequestId?: string | null;
  payload: T;
}

export interface SendMessageInput {
  channelId: string;
  authorId: string;
  content: string;
  clientRequestId?: string;
  replyToId?: string;
}

export interface SendMessageResult {
  message: CanonicalMessagePayload;
  isIdempotentReplay: boolean;
}

export interface KeysetPaginationParams {
  channelId: string;
  beforeSequence?: number;
  limit?: number;
}

export interface UpdateReadWatermarkInput {
  channelId: string;
  userId: string;
  sequence: number;
}

export interface UpdateChannelPreferencesInput {
  channelId: string;
  userId: string;
  isPinned?: boolean;
  mutedUntil?: Date | string | null;
}

export interface ToggleReactionInput {
  messageId: string;
  userId: string;
  emoji: string;
}

export interface EditMessageInput {
  messageId: string;
  userId: string;
  content: string;
  expectedRevision?: number;
}

export interface DeleteMessageInput {
  messageId: string;
  userId: string;
  reason?: string;
}

export interface TypingSignalInput {
  channelId: string;
  userId: string;
  isTyping: boolean;
}

export interface ChannelSyncParams {
  channelId: string;
  userId: string;
  clientSequence?: number;
  limit?: number;
}

export interface ChannelSyncResponse {
  mode: 'DELTA' | 'SNAPSHOT';
  channelId: string;
  streamId: string;
  currentSequence: number;
  watermarkSequence: number;
  events?: RealtimeEventEnvelope[];
  messages?: CanonicalMessagePayload[];
}

export class MessagingConflictError extends Error {
  constructor(message = 'Message request conflict with different payload') {
    super(message);
    this.name = 'MessagingConflictError';
  }
}

export class MessagingForbiddenError extends Error {
  constructor(message = 'Forbidden to perform messaging action') {
    super(message);
    this.name = 'MessagingForbiddenError';
  }
}

export class MessagingNotFoundError extends Error {
  constructor(message = 'Channel or resource not found') {
    super(message);
    this.name = 'MessagingNotFoundError';
  }
}

export class MessagingValidationError extends Error {
  constructor(message = 'Invalid message payload') {
    super(message);
    this.name = 'MessagingValidationError';
  }
}

/**
 * Deterministically hash message input payload for idempotency conflict detection.
 */
export function computeMessagePayloadHash(input: {
  channelId: string;
  content: string;
  replyToId?: string | null;
}): string {
  const normalized = JSON.stringify({
    channelId: input.channelId,
    content: input.content.trim(),
    replyToId: input.replyToId ?? null,
  });
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Build destination channel string based on channel parentage and generation.
 */
export function buildDestinationChannel(params: {
  channelId: string;
  generation: number;
  communityId?: string | null;
  conversationId?: string | null;
  conversationKind?: 'DIRECT' | 'GROUP' | null;
  studyRoomId?: string | null;
}): string {
  const gen = params.generation || 1;
  if (params.communityId) {
    return `community:${params.channelId}:g${gen}`;
  }
  if (params.conversationId) {
    const prefix = params.conversationKind === 'GROUP' ? 'group' : 'dm';
    return `${prefix}:${params.conversationId}:g${gen}`;
  }
  if (params.studyRoomId) {
    return `roomchat:${params.channelId}:g${gen}`;
  }
  return `channel:${params.channelId}:g${gen}`;
}
