import { useCallback, useState } from 'react';
import { ConversationFilter, ConversationPreview, SidebarTab } from '../../models';
import { ComposeModal } from './ComposeModal/ComposeModal';
import { ConversationList } from './ConversationList/ConversationList';
import { SidebarFilters } from './SidebarFilters/SidebarFilters';
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
  onSearchClear?(): void;
  onMarkAllRead?(): void;
}

export function LeftSidebar({
  tabs,
  filters,
  selectedTab,
  selectedFilter,
  conversations,
  dmConversations = [],
  searchQuery,
  onTabChange,
  onFilterChange,
  onSelectConversation,
  onSearchClear,
  onMarkAllRead,
}: Props) {
  // Batch A: Compose modal + user menu state
  const [showCompose, setShowCompose] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const toggleUserMenu = useCallback(() => setShowUserMenu((p) => !p), []);

  return (
    <aside className={styles.sidebar}>
      {/* A5: Avatar dropdown + compose trigger */}
      <SidebarHeader
        onCompose={() => setShowCompose(true)}
        showUserMenu={showUserMenu}
        onToggleUserMenu={toggleUserMenu}
      />

      {/* A2+A7: Mark all read + clear search */}
      <SidebarFilters
        tabs={tabs}
        filters={filters}
        selectedTab={selectedTab}
        selectedFilter={selectedFilter}
        searchQuery={searchQuery}
        onTabChange={onTabChange}
        onFilterChange={onFilterChange}
        onSearchClear={onSearchClear}
        onMarkAllRead={onMarkAllRead}
      />

      <ConversationList
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        onMarkAllRead={onMarkAllRead}
      />

      {/* A1: Compose modal */}
      {showCompose && (
        <ComposeModal
          dmUsers={dmConversations}
          onSelect={(id) => {
            const user = dmConversations.find((u) => u.id === id);
            if (user) onSelectConversation(user);
          }}
          onClose={() => setShowCompose(false)}
        />
      )}
    </aside>
  );
}
