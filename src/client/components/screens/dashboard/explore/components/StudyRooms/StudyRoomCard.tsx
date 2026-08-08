import Image from 'next/image';
import { LiveSession } from '@/src/client/components/screens/dashboard/message/models';
import styles from './StudyRoomCard.module.css';

interface Props {
  session: LiveSession;
}

export function StudyRoomCard({ session }: Props) {
  return (
    <article className={styles.card} onDragStart={(e) => e.preventDefault()}>
      <Image width={800} height={600}
        className={styles.bg}
        src={session.thumbnail}
        alt=""
        draggable={false}
       />
      <div className={styles.overlayBar}>
        <div className={styles.textStack}>
          <h3 className={styles.roomName}>{session.title}</h3>
          <p className={styles.subtext}>{session.status}</p>
        </div>
        <div className={styles.avatars}>
          {session.avatars.slice(0, 3).map((person) => (
            <span key={person.id}>
              <Image width={100} height={100}
                src={person.avatar}
                alt=""
                draggable={false}
               />
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
