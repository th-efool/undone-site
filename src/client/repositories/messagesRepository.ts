import { apiUrl } from '@/src/shared/api/apiUrl';
import type { CanonicalMessagePayload } from '@/src/server/domain/messaging/contracts';

export interface EnrolledCommunityDTO {
  cohortId: string;
  cohortTitle: string;
  coverImage?: string | null;
  role: string;
  communityId: string;
  chatEnabled: boolean;
  channels: Array<{ id: string; name: string }>;
}

export interface ConversationSummaryDTO {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  title: string;
  channelId: string;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    authorName: string | null;
  };
  otherParticipant?: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
  participantCount: number;
  accessGeneration: number;
  updatedAt: string;
}

export interface DirectConversationResult {
  conversationId: string;
  channelId: string;
  kind: 'DIRECT';
  directKey: string;
  recipient: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
  isExisting: boolean;
}

export interface GroupConversationResult {
  conversationId: string;
  channelId: string;
  kind: 'GROUP';
  title: string;
  creatorId: string;
  participantCount: number;
}

export interface PersonSearchResult {
  id: string;
  name: string | null;
  image: string | null;
  username: string | null;
}

export type { CanonicalMessagePayload };

export const messagesRepository = {
  async fetchEnrolledCommunities(): Promise<EnrolledCommunityDTO[]> {
    try {
      const res = await fetch(apiUrl('/api/community'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch enrolled communities:', e);
      return [];
    }
  },

  async fetchChannelMessages(
    channelId: string,
    limit = 50,
    beforeCursor?: string
  ): Promise<CanonicalMessagePayload[]> {
    try {
      const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const url = new URL(apiUrl(`/api/community/channels/${channelId}/messages`), baseOrigin);
      url.searchParams.set('limit', String(limit));
      if (beforeCursor) {
        url.searchParams.set('before', beforeCursor);
      }

      const res = await fetch(url.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn(`Failed to fetch messages for channel ${channelId}:`, e);
      return [];
    }
  },

  async sendChannelMessage(
    channelId: string,
    payload: {
      content: string;
      clientRequestId?: string;
      replyToId?: string;
    }
  ): Promise<CanonicalMessagePayload> {
    const res = await fetch(apiUrl(`/api/community/channels/${channelId}/messages`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send message' }));
      throw new Error(err.error || `Send failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async fetchConversations(): Promise<ConversationSummaryDTO[]> {
    try {
      const res = await fetch(apiUrl('/api/conversations'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch conversations:', e);
      return [];
    }
  },

  async createDirectConversation(recipientId: string): Promise<DirectConversationResult> {
    const res = await fetch(apiUrl('/api/conversations'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ kind: 'DIRECT', recipientId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create direct conversation' }));
      throw new Error(err.error || `Direct conversation creation failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async createGroupConversation(
    title: string,
    participantIds: string[]
  ): Promise<GroupConversationResult> {
    const res = await fetch(apiUrl('/api/conversations'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ kind: 'GROUP', title, participantIds }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create group conversation' }));
      throw new Error(err.error || `Group conversation creation failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async leaveGroupConversation(conversationId: string): Promise<{ success: boolean }> {
    const res = await fetch(apiUrl(`/api/conversations/${conversationId}/leave`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to leave conversation' }));
      throw new Error(err.error || `Leave conversation failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async searchPeople(query: string, limit = 20): Promise<PersonSearchResult[]> {
    try {
      const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const url = new URL(apiUrl('/api/people'), baseOrigin);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to search people:', e);
      return [];
    }
  },

  async blockUser(blockedId: string): Promise<{ success: boolean }> {
    const res = await fetch(apiUrl('/api/blocks'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ blockedId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to block user' }));
      throw new Error(err.error || `Block failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async unblockUser(blockedId: string): Promise<{ success: boolean }> {
    const res = await fetch(apiUrl('/api/blocks'), {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ blockedId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to unblock user' }));
      throw new Error(err.error || `Unblock failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async reportMessage(messageId: string, reason: string): Promise<{ id: string }> {
    const res = await fetch(apiUrl('/api/reports'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ messageId, reason }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to report message' }));
      throw new Error(err.error || `Report failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async updateReadWatermark(
    channelId: string,
    sequence: number
  ): Promise<{ channelId: string; userId: string; lastReadSequence: number; unreadCount: number }> {
    const res = await fetch(apiUrl(`/api/community/channels/${channelId}/read`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ sequence }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update read watermark' }));
      throw new Error(err.error || `Read watermark update failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async updateChannelPreferences(
    channelId: string,
    prefs: { isPinned?: boolean; mutedUntil?: Date | string | null }
  ): Promise<{ channelId: string; userId: string; isPinned: boolean; mutedUntil: string | null }> {
    const res = await fetch(apiUrl(`/api/community/channels/${channelId}/preferences`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(prefs),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update preferences' }));
      throw new Error(err.error || `Preferences update failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async toggleReaction(
    messageId: string,
    emoji: string
  ): Promise<{ messageId: string; channelId: string; emoji: string; added: boolean; reactions: any[]; revision: number }> {
    const res = await fetch(apiUrl(`/api/messages/${messageId}/reactions`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ emoji }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update reaction' }));
      throw new Error(err.error || `Reaction update failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async editMessage(
    messageId: string,
    content: string,
    expectedRevision?: number
  ): Promise<CanonicalMessagePayload> {
    const res = await fetch(apiUrl(`/api/messages/${messageId}`), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ content, expectedRevision }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to edit message' }));
      throw new Error(err.error || `Edit message failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async deleteMessage(messageId: string, reason?: string): Promise<CanonicalMessagePayload> {
    const res = await fetch(apiUrl(`/api/messages/${messageId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete message' }));
      throw new Error(err.error || `Delete message failed with HTTP ${res.status}`);
    }

    return await res.json();
  },

  async sendTypingSignal(
    channelId: string,
    isTyping = true
  ): Promise<{ success: boolean; throttled: boolean }> {
    try {
      const res = await fetch(apiUrl(`/api/community/channels/${channelId}/typing`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ isTyping }),
      });

      if (!res.ok) return { success: false, throttled: false };
      return await res.json();
    } catch (e) {
      return { success: false, throttled: false };
    }
  },
};
