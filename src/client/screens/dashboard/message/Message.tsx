'use client';

import { useExperience } from '@/src/client/hooks/useExperience';
import { useMessage } from './hooks';
import { MessageDesktop } from './MessageDesktop';
import { MessageMobile } from '@/src/client/mobile/screens/Message/MessageMobile';

export function Message() {
  const experience = useExperience();
  const message = useMessage();

  if (experience === 'mobile') {
    return <MessageMobile model={message} />;
  }

  return <MessageDesktop model={message} />;
}
