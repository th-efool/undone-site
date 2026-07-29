/* eslint-disable @next/next/no-img-element */
import { LiveSession } from '../../../models';
import styles from './LiveCard.module.css';
interface Props {
  session: LiveSession;
}
export function LiveCard({ session }: Props) {
  return (
    <article className={styles.card}>
      <img
        className={styles.bg}
        src={session.thumbnail}
        alt=""
      />
      <div className={styles.shade} />
      {session.live && <span className={styles.live}>LIVE</span>}
      <div className={styles.content}>
        <div className={styles.avatars}>
          {session.avatars.slice(0, 4).map((person) => (
            <span key={person.id}>
              <img
                src={person.avatar}
                alt=""
              />
              {person.online && <i />}
            </span>
          ))}
        </div>
        <h3>{session.title}</h3>
        <p>{session.status}</p>
        <button
          className={session.primary ? styles.primary : ''}
          type="button"
        >
          Join
        </button>
      </div>
    </article>
  );
}
