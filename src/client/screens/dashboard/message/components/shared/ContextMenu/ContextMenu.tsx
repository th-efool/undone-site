import { useEffect, useRef } from 'react';
import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  kbd?: string;
  onClick(): void;
}

interface Props {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose(): void;
}

export function ContextMenu({ items, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Clamp position to viewport
  const menuWidth = 200;
  const menuHeight = items.length * 44 + 16;
  const maxX = Math.max(8, window.innerWidth - menuWidth - 8);
  const maxY = Math.max(8, (typeof window !== 'undefined' ? window.innerHeight : 700) - menuHeight - 8);
  const clampedX = Math.min(x, maxX);
  const clampedY = Math.min(y, maxY);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <nav ref={ref} className={styles.menu} style={{ left: clampedX, top: clampedY }} role="menu">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.item}${item.danger ? ` ${styles.danger}` : ''}`}
            onClick={() => { item.onClick(); onClose(); }}
            role="menuitem"
          >
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            {item.label}
            {item.kbd && <kbd className={styles.kbd}>{item.kbd}</kbd>}
          </button>
        ))}
      </nav>
    </>
  );
}
