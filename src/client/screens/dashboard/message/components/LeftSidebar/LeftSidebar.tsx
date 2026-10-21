import { useState } from 'react';
import { ConversationFilter, ConversationPreview, SidebarTab } from '../../models';
import { ComposeModal } from './ComposeModal/ComposeModal';
import { ConversationList } from './ConversationList/ConversationList';
import { SidebarHeader } from './SidebarHeader/SidebarHeader';
import styles from './LeftSidebar.module.css';

interface Props {
  tabs: { id: SidebarTab; label: string }[];
  filters: { id: ConversationFilter; label: string }[];
  selectedTab: SidebarTab;
  selectedFilter: ConversationFilter;
  conversations: ConversationPreview[];
  dmConversations?: ConversationPreview[]; // for compose modal — A1
  searchQuery: string;
  onTabChange(tab: SidebarTab): void;
  onFilterChange(filter: ConversationFilter): void;
  onSelectConversation(conversation: ConversationPreview): void;
  onCreateDirectConversation?(recipientId: string): Promise<string>;
  onCreateGroupConversation?(title: string, participantIds: string[]): Promise<string>;
  onSearchClear?(): void;
  onMarkAllRead?(): void;
  onGoHome?(): void;
  isHome?: boolean;
}

export function LeftSidebar({
  tabs,
  selectedTab,
  conversations,
  onTabChange,
  onSelectConversation,
  onCreateDirectConversation,
  onCreateGroupConversation,
  onMarkAllRead,
  onGoHome,
  isHome,
}: Props) {
  const [showCompose, setShowCompose] = useState(false);

  return (
    <aside className={styles.sidebar}>
      <SidebarHeader
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={onTabChange}
        onCompose={() => setShowCompose(true)}
        onMarkAllRead={onMarkAllRead}
        onGoHome={onGoHome}
        isHome={isHome}
      />

      <ConversationList
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        onMarkAllRead={onMarkAllRead}
      />

      {/* A1: Compose modal */}
      {showCompose && (
        <ComposeModal
          onCreateDirect={onCreateDirectConversation}
          onCreateGroup={onCreateGroupConversation}
          onSelect={(id) => {
            const user = conversations.find((u) => u.id === id);
            if (user) {
              onSelectConversation(user);
            } else {
              onSelectConversation({
                id,
                kind: 'dm',
                name: 'Direct Message',
                avatar: '/undone-logo.svg',
                sender: '',
                preview: '',
                timestamp: '',
              });
            }
          }}
          onClose={() => setShowCompose(false)}
        />
      )}
    </aside>
  );
}
