import styles from './ExploreSearch.module.css';
import { Search } from 'lucide-react';

interface ExploreSearchProps {
  query: string;
  onChange: (query: string) => void;
}

export function ExploreSearch({ query, onChange }: ExploreSearchProps) {
  return (
    <div className={styles.container}>
      <div className={styles.searchWrapper}>
        <Search className={styles.icon} size={20} />
        <input
          type="text"
          className={styles.input}
          placeholder="Search topics, creators, playlists..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
