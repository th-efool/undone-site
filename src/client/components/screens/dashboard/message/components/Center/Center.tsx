import { LiveSession, RecentMessage } from '../../models';
import { LiveNow } from './LiveNow/LiveNow';
import { RecentMessages } from './RecentMessages/RecentMessages';
import { SearchHeader } from './SearchHeader/SearchHeader';
import styles from './Center.module.css';
interface Props {
  query: string;
  liveSessions: LiveSession[];
  recentMessages: RecentMessage[];
  onSearchChange(value: string): void;
}
export function Center({ query, liveSessions, recentMessages, onSearchChange }: Props) {
  return (
    <main className={styles.center}>
      <SearchHeader
        query={query}
        onChange={onSearchChange}
      />
      <LiveNow items={liveSessions} />
      <RecentMessages items={recentMessages} />
    </main>
  );
}
