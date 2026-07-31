'use client';

import { useEffect, useRef } from 'react';
import { Copy, Trash2, Split, Sliders, Eye } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './CurriculumContextMenu.module.css';

interface CurriculumContextMenuProps {
  x: number;
  y: number;
  type: 'season' | 'lesson';
  targetId: string;
  onClose: () => void;
}

export function CurriculumContextMenu({ x, y, type, targetId, onClose }: CurriculumContextMenuProps) {
  const { actions } = useWizardContext();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className={styles.contextMenu} style={{ top: y, left: x }}>
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          if (type === 'lesson') actions.selectLesson(targetId);
          else actions.selectSeason(targetId);
          onClose();
        }}
      >
        <Sliders size={14} />
        Inspect & Edit
      </button>

      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          if (type === 'lesson') actions.duplicateLesson(targetId);
          else actions.duplicateSeason(targetId);
          onClose();
        }}
      >
        <Copy size={14} />
        Duplicate {type}
      </button>

      {type === 'season' && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            actions.splitSeason(targetId);
            onClose();
          }}
        >
          <Split size={14} />
          Split Season
        </button>
      )}

      {type === 'lesson' && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            actions.updateLesson(targetId, { visibility: 'Public' });
            onClose();
          }}
        >
          <Eye size={14} />
          Set Public
        </button>
      )}

      <div className={styles.divider} />

      <button
        type="button"
        className={`${styles.menuItem} ${styles.deleteItem}`}
        onClick={() => {
          if (type === 'lesson') actions.deleteLesson(targetId);
          else actions.deleteSeason(targetId);
          onClose();
        }}
      >
        <Trash2 size={14} />
        Delete {type}
      </button>
    </div>
  );
}
