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
                    <img
                        src={card.image}
                        alt=""
                        className={styles.image}
                    />

                    <div className={styles.overlay} />

                    <div className={styles.content}>
                        <h3>{card.title}</h3>

                        <p>{card.subtitle}</p>

                        <div className={styles.footer}>
                            <span>{card.members}</span>

                            <span>{card.online}</span>
                        </div>

                        <div className={styles.progress}>
                            <span
                                className={styles.bar}
                                style={{ width: card.progress }}
                            />
                        </div>
                    </div>
                </article>
            ))}
        </section>
    );
}