import { InfiniteScroller } from '@/src/client/components/global/InfiniteScroller';
import { LiveSession } from '@/src/client/screens/dashboard/message/models';
import { StudyRoomCard } from './StudyRoomCard';

import styles from './StudyRooms.module.css';

interface StudyRoomsProps {
  items: LiveSession[];
}

export function StudyRooms({ items }: StudyRoomsProps) {
  return (
    <section className={styles.section} aria-labelledby="study-rooms-heading">
      <h2 id="study-rooms-heading" className={styles.title}>
        Study, chat, and get work done<br />with learners from around the world.
      </h2>
      <div className={styles.scrollerWrapper}>
        <InfiniteScroller
          scrollAmount={740}
          loop={true}
          panable={true}
          showArrows={false}
          autoScroll={true}
          autoScrollSpeed={0.4}
        >
          {items.map((item) => (
            <StudyRoomCard
              key={item.id}
              session={item}
            />
          ))}
        </InfiniteScroller>
      </div>
    </section>
  );
}
