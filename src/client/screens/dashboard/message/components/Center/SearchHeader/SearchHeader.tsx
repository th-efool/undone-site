import { SearchBar } from '@/src/client/components/global/SearchBar';
import styles from './SearchHeader.module.css';
interface Props {
  query: string;
  onChange(value: string): void;
}
export function SearchHeader({ query, onChange }: Props) {
  return (
    <SearchBar
      className={styles.search}
      value={query}
      onChange={onChange}
      placeholder="Search communities, people, or messages..."
    />
  );
}
