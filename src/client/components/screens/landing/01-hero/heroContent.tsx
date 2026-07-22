import styles from "./heroContent.module.css";

export function HeroContent() {
    return (
        <section className={styles.content}>
            <div className={styles.eyebrow}>
                BOOKMARKS. WATCH LATER. HALF-FINISHED COURSES. DROPPED HOBBIES.
            </div>

            <h1 className={styles.title}>
                Curiosity shouldn't feel like{" "}
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

                <button className={styles.ctaButton}>
                    Start Your Next SideQuest
                    <span className={styles.ctaIcon}>→</span>
                </button>
            </div>

            <div className={styles.note}>
                It only takes 2 minutes.
                <br />
                It'll keep the momentum.
            </div>
        </section>
    );
}
