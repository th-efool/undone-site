import { PersonPreview, UpcomingEvent } from '../../models';
import { FriendsOnline } from './FriendsOnline/FriendsOnline';
import { UpcomingEvents } from './UpcomingEvents/UpcomingEvents';
import styles from './RightSidebar.module.css';

interface Props {
  upcomingEvents: UpcomingEvent[];
  friendsOnline: PersonPreview[];
}

export function RightSidebar({ upcomingEvents, friendsOnline }: Props) {
  const hasEvents = upcomingEvents && upcomingEvents.length > 0;
  const hasFriends = friendsOnline && friendsOnline.length > 0;

  if (!hasEvents && !hasFriends) {
    return null;
  }

  return (
    <aside className={styles.sidebar}>
      {hasEvents && <UpcomingEvents items={upcomingEvents} />}
      {hasFriends && <FriendsOnline friends={friendsOnline} />}
    </aside>
  );
}
