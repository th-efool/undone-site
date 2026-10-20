import React from 'react';
import { Info } from 'lucide-react';
import styles from './DemoDataNote.module.css';

export interface DemoDataNoteProps {
  children?: React.ReactNode;
  className?: string;
}

export function DemoDataNote({ children, className }: DemoDataNoteProps) {
  return (
    <div className={`${styles.note} ${className ?? ''}`}>
      <Info size={13} className={styles.icon} aria-hidden="true" />
      <span>{children ?? 'Prototype · sample participants and roles.'}</span>
    </div>
  );
}

export default DemoDataNote;
