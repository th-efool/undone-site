import { MessageCircle, UsersRound } from 'lucide-react';
import { ConversationFilter, SidebarTab } from '../../../models';
import styles from './SidebarFilters.module.css';

interface Props {
  tabs: { id: SidebarTab; label: string }[];
  filters: { id: ConversationFilter; label: string }[];
  selectedTab: SidebarTab;
  selectedFilter: ConversationFilter;
  onTabChange(tab: SidebarTab): void;
  onFilterChange(filter: ConversationFilter): void;
}
const counts: Partial<Record<ConversationFilter, number>> = {
  unread: 59,
  mentions: 7,
};
export function SidebarFilters({
  tabs,
  filters,
  selectedTab,
  selectedFilter,
  onTabChange,
  onFilterChange,
}: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === selectedTab ? styles.activeTab : ''}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.id === 'community' ? <UsersRound size={18} /> : <MessageCircle size={18} />}{' '}
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.chips}>
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={filter.id === selectedFilter ? styles.activeChip : ''}
            onClick={() => onFilterChange(filter.id)}
          >
            {filter.label}
            {counts[filter.id] && <span>{counts[filter.id]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
