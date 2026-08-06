import { useEffect, useRef, useState } from 'react';
import { Bell, Settings, UserCircle, UsersRound, MessageCircle, House, CheckCheck, SlidersHorizontal, ArrowUpDown, SquarePen } from 'lucide-react';
import type { SidebarTab } from '../../../models';
import { getAvatar } from '@/src/client/mock/avatars';
import styles from './SidebarHeader.module.css';

interface Props {
  tabs: { id: SidebarTab; label: string }[];
  selectedTab: SidebarTab;
  onTabChange(tab: SidebarTab): void;
  onGoHome?(): void;
  isHome?: boolean;
  onCompose?(): void;
  onMarkAllRead?(): void;
  showUserMenu: boolean;
  onToggleUserMenu(): void;
}

const menuItems = [
  { label: 'Your Profile', icon: <UserCircle size={18} />, action: () => {} },
  { label: 'Settings', icon: <Settings size={18} />, action: () => {} },
  { label: 'Notifications', icon: <Bell size={18} />, action: () => {} },
];

export function SidebarHeader({ tabs, selectedTab, onTabChange, onGoHome, isHome, onCompose, onMarkAllRead, showUserMenu, onToggleUserMenu }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [filterActive, setFilterActive] = useState(false);
  const [sortActive, setSortActive] = useState(false);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggleUserMenu();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showUserMenu, onToggleUserMenu]);

  return (
    <header className={styles.header}>
      <div className={styles.strip}>

        {/* Home */}
        {onGoHome && (
          <button
            type="button"
            className={`${styles.homeBtn} ${isHome ? styles.activeTab : ''}`}
            onClick={onGoHome}
            aria-label="Home"
            title="Home"
          >
            <House size={20} />
          </button>
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
            <button
              type="button"
              className={styles.actionBtn}
              aria-label="Mark all as read"
              title="Mark all as read"
              onClick={onMarkAllRead}
            >
              <CheckCheck size={16} />
            </button>
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

        {/* Avatar */}
        <div className={styles.userWrap} ref={menuRef}>
          <button type="button" className={`${styles.avatarBtn}${showUserMenu ? ' ' + styles.active : ''}`} onClick={onToggleUserMenu} aria-label="User menu">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatar('shaqun')} alt="" />
          </button>
          {showUserMenu && (
            <div className={styles.dropdown}>
              {menuItems.map((item) => (
                <button key={item.label} type="button" className={styles.dropItem} onClick={() => { item.action(); onToggleUserMenu(); }}>
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
