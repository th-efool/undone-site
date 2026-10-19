import { dmConversationMock } from '@/src/client/screens/dashboard/message/mock/dmConversation.mock';
import { messageMock } from '@/src/client/screens/dashboard/message/mock/message.mock';
import { homeRepository } from './homeRepository';

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
};
