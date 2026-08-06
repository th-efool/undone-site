import { PersonPreview, UpcomingEvent } from '../../models';
import { FriendsOnline } from './FriendsOnline/FriendsOnline';
import { UpcomingEvents } from './UpcomingEvents/UpcomingEvents';
import styles from './RightSidebar.module.css';
interface Props {
  upcomingEvents: UpcomingEvent[];
  friendsOnline: PersonPreview[];
}
export function RightSidebar({ upcomingEvents, friendsOnline }: Props) {
  return (
    <aside className={styles.sidebar}>
      <UpcomingEvents items={upcomingEvents} />
      <FriendsOnline friends={friendsOnline} />
    </aside>
  );
}
