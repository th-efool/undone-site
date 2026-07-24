import styles from "./authStats.module.css";

const STATS = [
    {
        value: "10K+",
        label: "Active Learners",
    },
    {
        value: "250K+",
        label: "Hours Studied",
    },
    {
        value: "4.9★",
        label: "Average Rating",
    },
];

export function AuthStats() {
    return (
        <section
            className={styles.stats}
            aria-label="Community statistics"
        >
            {STATS.map((stat) => (
                <div
                    key={stat.label}
                    className={styles.item}
                >
                    <div className={styles.value}>
                        {stat.value}
                    </div>

                    <div className={styles.label}>
                        {stat.label}
                    </div>
                </div>
            ))}
        </section>
    );
}