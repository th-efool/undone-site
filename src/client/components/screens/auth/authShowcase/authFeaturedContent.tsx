import styles from "./authFeaturedContent.module.css";
import { FEATURED_CONTENT } from "./authData";

export default function AuthFeaturedContent() {
    return (
        <section className={styles.row}>
            {FEATURED_CONTENT.map((card) => (
                <article
                    key={card.id}
                    className={styles.card}
                >
                    <div className={styles.thumbnail}>
                        <img
                            src={card.image}
                            alt=""
                            className={styles.image}
                        />
                    </div>

                    <div className={styles.content}>

                        <h3 className={styles.title}>
                            {card.title}
                        </h3>

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