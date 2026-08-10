import Image from 'next/image';
/* eslint-disable @next/next/no-img-element */
import { LiveSession } from '../../../models';
import styles from './LiveCard.module.css';
interface Props {
  session: LiveSession;
}
export function LiveCard({ session }: Props) {
  return (
    <article className={styles.card} onDragStart={(e) => e.preventDefault()}>
      <Image width={400} height={300}
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
              <Image width={400} height={300}
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
