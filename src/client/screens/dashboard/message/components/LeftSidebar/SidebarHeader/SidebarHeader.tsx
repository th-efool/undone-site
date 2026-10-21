import { useState } from 'react';
import { UsersRound, MessageCircle, House, CheckCheck, SlidersHorizontal, ArrowUpDown, SquarePen } from 'lucide-react';
import type { SidebarTab } from '../../../models';
import { Tooltip } from '@/src/client/components/ui';
import styles from './SidebarHeader.module.css';

interface Props {
  tabs: { id: SidebarTab; label: string }[];
  selectedTab: SidebarTab;
  onTabChange(tab: SidebarTab): void;
  onGoHome?(): void;
  isHome?: boolean;
  onCompose?(): void;
  onMarkAllRead?(): void;
}

export function SidebarHeader({ tabs, selectedTab, onTabChange, onGoHome, isHome, onCompose, onMarkAllRead }: Props) {
  const [filterActive, setFilterActive] = useState(false);
  const [sortActive, setSortActive] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.strip}>

        {/* Home */}
        {onGoHome && (
          <Tooltip content="Social Home" placement="top">
            <button
              type="button"
              className={`${styles.homeBtn} ${isHome ? styles.activeTab : ''}`}
              onClick={onGoHome}
              aria-label="Social Home"
              title="Social Home"
            >
              <House size={20} />
            </button>
          </Tooltip>
        )}

        <div className={styles.divider} />

        {/* Community / DMs — same row */}
        <div className={styles.tabRow}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tabBtn} ${tab.id === selectedTab ? styles.activeTab : ''}`}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              title={tab.label}
            >
              {tab.id === 'community' ? <UsersRound size={18} /> : <MessageCircle size={18} />}
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        {/* Actions Row: Draft Message | Mark All Read | Filter | Sort */}
        <div className={styles.actionsRow}>
          {onCompose && (
            <button
              type="button"
              className={styles.actionBtn}
              aria-label="Draft message"
              title="Draft message"
              onClick={onCompose}
            >
              <SquarePen size={16} />
            </button>
          )}

          {onMarkAllRead && (
            <Tooltip content="Mark all as read" placement="top">
              <button
                type="button"
                className={styles.actionBtn}
                aria-label="Mark all as read"
                title="Mark all as read"
                onClick={onMarkAllRead}
              >
                <CheckCheck size={16} />
              </button>
            </Tooltip>
          )}

          <button
            type="button"
            className={`${styles.actionBtn} ${filterActive ? styles.actionActive : ''}`}
            aria-label="Filter"
            title="Filter"
            onClick={() => setFilterActive(p => !p)}
          >
            <SlidersHorizontal size={16} />
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${sortActive ? styles.actionActive : ''}`}
            aria-label="Sort"
            title="Sort"
            onClick={() => setSortActive(p => !p)}
          >
            <ArrowUpDown size={16} />
          </button>
        </div>

      </div>
    </header>
  );
}
