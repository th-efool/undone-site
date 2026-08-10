import Image from 'next/image';
import styles from './authFeaturedContent.module.css';
import { FEATURED_CONTENT } from './authData';

export default function AuthFeaturedContent() {
  return (
    <section className={styles.row}>
      {FEATURED_CONTENT.map((card) => (
        <article
          key={card.id}
          className={styles.card}
        >
          <div className={styles.thumbnail}>
            <Image
              src={card.image}
              alt=""
              className={styles.image}
             width={400} height={300} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>

          <div className={styles.content}>
            <h3 className={styles.title}>{card.title}</h3>

            <div className={styles.stats}>
              <span>👥 {card.members}</span>

              <span>🟢 {card.online}</span>

              <span>Avg {card.progress}</span>
            </div>

            <div className={styles.progress}>
              <span
                className={styles.progressFill}
                style={{
                  width: card.progress,
                }}
              />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
