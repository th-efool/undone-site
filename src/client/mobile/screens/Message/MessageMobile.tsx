'use client';

import type { UseMessageResult } from '@/src/client/screens/dashboard/message/hooks/useMessage';
import styles from './MessageMobile.module.css';

interface MessageMobileProps {
  model: UseMessageResult;
}

export function MessageMobile({ model: message }: MessageMobileProps) {
  return (
    <main className={styles.mobileMessage}>
      <header className={styles.header}>
        <h1 className={styles.title}>Messages</h1>
        <p className={styles.subtitle}>Connect with your cohort peers</p>
      </header>

      <div className={styles.chatList}>
        {message.conversations.map((conv) => (
          <div key={conv.id} className={styles.chatItem} onClick={() => message.actions.selectConversation(conv)}>
            <div className={styles.avatar}>{conv.name.slice(0, 1).toUpperCase()}</div>
            <div className={styles.chatMeta}>
              <span className={styles.chatName}>{conv.name}</span>
              <span className={styles.chatMessage}>{conv.preview || 'Active study group'}</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
