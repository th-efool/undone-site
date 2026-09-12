import { ChevronRight, ChevronDown, FileText, X } from 'lucide-react';
import { useState } from 'react';
import styles from './RightColumn.module.css';
import type { useNotes } from '../../hooks/useNotes';
import type { RecentlyClosedNote } from '../../hooks/useRecentlyClosedNotes';

interface RecentlyClosedSectionProps {
  notes: ReturnType<typeof useNotes>;
  closedNotes: RecentlyClosedNote[];
  onRemove: (id: string) => void;
}

export function RecentlyClosedSection({ notes, closedNotes, onRemove }: RecentlyClosedSectionProps) {
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);

  if (closedNotes.length === 0) {
    return null; // Don't show if there are no recently closed notes
  }

  return (
    <div className={styles.sectionContainer}>
      <header className={styles.sectionHeader} onClick={() => setIsSectionExpanded(!isSectionExpanded)}>
        <span className={styles.sectionChevron}>
          {isSectionExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className={styles.sectionTitle}>Recently Closed</span>
      </header>
      
      {isSectionExpanded && (
        <div className={styles.sectionListContainer}>
          <div className={styles.workspaceTree}>
            {closedNotes.map(note => (
              <div key={note.id} className={styles.treeItemWrapper}>
                <div 
                  className={styles.treeItem} 
                  style={{ paddingLeft: '8px' }}
                  onClick={() => notes.actions.selectNote(note.id)}
                >
                  <span 
                    className={styles.sectionChevron} 
                    style={{ width: '16px', display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: 0.7 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(note.id);
                    }}
                    title="Remove from recently closed"
                  >
                    <X size={12} />
                  </span>
                  <span className={styles.treeIcon}><FileText size={14} /></span>
                  <span className={styles.nodeLabel}>{note.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
