import { Search } from 'lucide-react';

import styles from '../../Archives.module.css';

export function ArchiveSearch() {
  return (
    <label className={styles.search}>
      <Search size={18} />
      <input placeholder="Search archives..." />
    </label>
  );
}
