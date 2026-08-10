import { LiveSession, RecentMessage } from '../../models';
import { EmptyState } from '../shared/EmptyState/EmptyState';
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
  const hasResults = (liveSessions.length > 0 || recentMessages.length > 0);

  return (
    <main className={styles.center}>
      <SearchHeader
        query={query}
        onChange={onSearchChange}
      />
      {hasResults ? (
        <>
          <LiveNow items={liveSessions} />
          <RecentMessages items={recentMessages} />
        </>
      ) : (
        <EmptyState
          title={
            query.length > 0
              ? 'No results found'
              : 'Nothing to see yet'
          }
          message={
            query.length > 0
              ? 'Try different keywords or check your spelling.'
              : 'Search communities, people, or messages to get started.'
          }
        />
      )}
    </main>
  );
}
