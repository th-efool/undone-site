import { useEffect, useRef } from 'react';
import { Bell, Settings, UserCircle, ChevronDown } from 'lucide-react';
import styles from './SidebarHeader.module.css';

interface Props {
  onCompose?(): void;
  showUserMenu: boolean;
  onToggleUserMenu(): void;
}

const menuItems = [
  { label: 'Your Profile', icon: <UserCircle size={18} />, action: () => {} },
  { label: 'Settings', icon: <Settings size={18} />, action: () => {} },
  { label: 'Notifications', icon: <Bell size={18} />, action: () => {} },
];

export function SidebarHeader({ onCompose, showUserMenu, onToggleUserMenu }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

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
      <h1>Social</h1>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Compose button — A1 */}
        {onCompose && (
          <button type="button" aria-label="New message" onClick={onCompose}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </svg>
          </button>
        )}

        {/* Avatar + User Menu — A5 */}
        <div className={styles.userWrap} ref={menuRef}>
          <button type="button" className={`${styles.avatarBtn}${showUserMenu ? ' ' + styles.active : ''}`} onClick={onToggleUserMenu} aria-label="User menu">
            <img src="/mock/avatars/a.webp" alt="" />
            <ChevronDown size={14} style={{ marginLeft: '2px', opacity: 0.5 }} />
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
