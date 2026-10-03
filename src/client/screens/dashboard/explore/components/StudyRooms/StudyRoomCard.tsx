import Image from 'next/image';
import Link from 'next/link';
import { LiveSession } from '@/src/client/screens/dashboard/message/models';
import styles from './StudyRoomCard.module.css';

interface Props {
  session: LiveSession;
}

export function StudyRoomCard({ session }: Props) {
  return (
    <Link
      href="/message"
      className={styles.card}
      onDragStart={(e) => e.preventDefault()}
      draggable={false}
    >
      <Image
        width={800}
        height={600}
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
            <span key={person.id} className={styles.avatarWrapper}>
              <Image
                width={27}
                height={27}
                src={person.avatar}
                alt=""
                draggable={false}
                className={styles.avatar}
              />
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
