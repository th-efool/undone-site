import { dmConversationMock } from '@/src/client/screens/dashboard/message/mock/dmConversation.mock';
import { messageMock } from '@/src/client/screens/dashboard/message/mock/message.mock';
import { homeRepository } from './homeRepository';
import { apiUrl } from '@/src/shared/api/apiUrl';

export interface EnrolledCommunityDTO {
  cohortId: string;
  cohortTitle: string;
  coverImage?: string | null;
  role: string;
  communityId: string;
  chatEnabled: boolean;
  channels: Array<{ id: string; name: string }>;
}

export const messagesRepository = {
  getMessageBase() {
    return messageMock;
  },
  getDMConversation() {
    return dmConversationMock;
  },
  getEnrolledCohorts() {
    const home = homeRepository.getHome({ loadStored: typeof window !== 'undefined' });
    return [...home.activeCohorts, ...home.continueLater];
  },
  async fetchEnrolledCommunities(): Promise<EnrolledCommunityDTO[]> {
    try {
      const res = await fetch(apiUrl('/api/community'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch enrolled communities:', e);
      return [];
    }
  },
};
