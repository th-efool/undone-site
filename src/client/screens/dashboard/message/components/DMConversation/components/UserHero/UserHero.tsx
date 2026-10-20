import Image from 'next/image';
import { DMUser } from '../../../../models';
import styles from './UserHero.module.css';

interface Props {
  user: DMUser;
}

export function UserHero({ user }: Props) {
  return (
    <section className={styles.hero}>
      <span>
        <Image width={80} height={80} src={user.avatar} alt={user.name} className={styles.avatar} />
        {user.online && <i />}
      </span>
      <h2>{user.name}</h2>
      <p>{user.role === 'Group DM' ? (user.company || 'Group Chat') : (user.bio || 'Direct Message')}</p>
    </section>
  );
}
