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
};
