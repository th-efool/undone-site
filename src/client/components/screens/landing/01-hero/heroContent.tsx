import styles from "./heroContent.module.css";
import Link from "next/link";

export function HeroContent() {
    return (
        <section className={styles.content}>
            <div className={styles.eyebrow}>
                BOOKMARKS. WATCH LATER. HALF-FINISHED COURSES. DROPPED HOBBIES.
            </div>

            <h1 className={styles.title}>
                Curiosity shouldn&#39;t feel like{" "}
                <span className={styles.titleAccent}>a burden.</span>
            </h1>

            <p className={styles.description}>
                Somewhere along the way, your curiosity became another item on
                your to-do list, constantly pushed aside by responsibilities.
            </p>

            <div className={styles.actions}>
                <button className={styles.demoButton}>
                    <span className={styles.demoIcon}>▶</span>
                    See How It Works
                </button>

                <Link href="/auth" className={styles.ctaButton}>
                    <span>Start Your Next SideQuest</span>
                    <span className={styles.ctaIcon}>→</span>
                </Link>
            </div>

            <div className={styles.note}>
                It only takes 2 minutes.
                <br />
                It&#39;ll keep the momentum.
            </div>
        </section>
    );
}
