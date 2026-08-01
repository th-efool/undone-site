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

  // Count unread for the "Mark all read" button — A2
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <div className={styles.list}>
      {/* Mark all read action — A2 */}
      {totalUnread > 0 && onMarkAllRead && (
        <button type="button" className={styles.markAllRead} onClick={onMarkAllRead}>
          <CheckCircle2 size={14} />
          Mark all read ({totalUnread})
        </button>
      )}

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
