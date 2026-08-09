import { Users, Globe } from 'lucide-react';
import styles from './RightColumn.module.css';

export function TopBar() {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarControls}>
        <div className={styles.topBarIcon}>
          <Users size={16} />
          <span>15</span>
        </div>
        <div className={styles.topBarIcon}>
          <Globe size={16} />
        </div>
      </div>
    </div>
  );
}
