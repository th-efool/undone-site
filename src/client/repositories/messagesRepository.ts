import { dmConversationMock } from '@/src/client/components/screens/dashboard/message/mock/dmConversation.mock';
import { messageMock } from '@/src/client/components/screens/dashboard/message/mock/message.mock';
import { homeRepository } from './homeRepository';

export const messagesRepository = {
  getMessageBase() {
    return messageMock;
  },
  getDMConversation() {
    return dmConversationMock;
  },
  getEnrolledCohorts() {
    const home = homeRepository.getHome();
    return [...home.activeCohorts, ...home.continueLater];
  },
};
