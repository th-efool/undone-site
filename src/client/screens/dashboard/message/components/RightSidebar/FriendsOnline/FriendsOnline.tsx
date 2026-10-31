import { PersonPreview } from '../../../models';
import { FriendAvatarGroup } from '@/src/client/components/global/FriendAvatarGroup';
import styles from './FriendsOnline.module.css';
interface Props {
  friends: PersonPreview[];
}
export function FriendsOnline({ friends }: Props) {
  return (
    <section className={styles.panel}>
      <header>
        <h2>Friends Online</h2>
        <button type="button">See all</button>
      </header>
      <FriendAvatarGroup
        friends={friends}
        overflow={24}
      />
    </section>
  );
}
