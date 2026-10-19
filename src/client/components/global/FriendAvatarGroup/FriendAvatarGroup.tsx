import Image from 'next/image';
import { PersonPreview } from '@/src/client/types/dashboard';
import styles from './FriendAvatarGroup.module.css';
interface Props {
  friends: PersonPreview[];
  overflow: number;
}
export function FriendAvatarGroup({ friends, overflow }: Props) {
  return (
    <div className={styles.group}>
      {friends.slice(0, 5).map((friend) => (
        <span key={friend.id}>
          <Image width={32} height={32} src={friend.avatar} alt={friend.name} unoptimized />
          {friend.online && <i />}
        </span>
      ))}
      <b>+{overflow}</b>
    </div>
  );
}
