import { CheckCircle2 } from 'lucide-react';
import { ConversationPreview } from '../../../models';
import { EmptyState } from '../../shared';
import { ConversationItem } from '../ConversationItem/ConversationItem';
import styles from './ConversationList.module.css';

interface Props {
  conversations: ConversationPreview[];
  onSelectConversation(conversation: ConversationPreview): void;
  onMarkAllRead?(): void;
}

export function ConversationList({ conversations, onSelectConversation, onMarkAllRead }: Props) {
  if (!conversations.length) {
    return (
      <div className={styles.list}>
        <EmptyState
          title="No conversations found"
          message="Try another filter or search across SideQuestHQ communities and DMs."
        />
      </div>
    );
  }

  return (
    <div className={styles.list}>

      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          onSelect={onSelectConversation}
        />
      ))}
    </div>
  );
}
