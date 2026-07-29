import { SquarePen } from 'lucide-react';
import styles from './SidebarHeader.module.css';

export function SidebarHeader() {
  return (
    <header className={styles.header}>
      <h1>Social</h1>
      <button
        type="button"
        aria-label="Compose"
      >
        <SquarePen size={21} />
      </button>
    </header>
  );
}
