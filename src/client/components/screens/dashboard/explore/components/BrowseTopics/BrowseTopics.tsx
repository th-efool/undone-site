import { TopicChip } from './TopicChip';

import type { Topic } from '../../models';

import styles from './BrowseTopics.module.css';

export interface BrowseTopicsProps {
  items: Topic[];
}

export function BrowseTopics({ items }: BrowseTopicsProps) {
  return (
    <section
      className={styles.section}
      aria-labelledby="browse-topics-heading"
    >
      <div className={styles.header}>
        <h2
          id="browse-topics-heading"
          className={styles.title}
        >
          A dose of inspiration,
          <br />
          whenever you need it.
        </h2>
      </div>

      <div className={styles.topicsGrid}>
        {items.map((item) => (
          <TopicChip
            key={item.id}
            item={item}
          />
        ))}
      </div>
    </section>
  );
}
