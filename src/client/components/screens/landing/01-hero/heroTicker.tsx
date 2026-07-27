import Image from "next/image";
import styles from "./heroTicker.module.css";

const avatars = ["a", "b", "c", "d", "e"];

export function HeroTicker() {
    return (
        <div className={styles.ticker}>
            {/* Avatars */}
            <div className={styles.avatars}>
                {avatars.map((avatar) => (
                    <div key={avatar} className={styles.avatar}>
                        <Image
                            src={`/mock/avatars/${avatar}.webp`}
                            alt=""
                            width={42}
                            height={42}
                        />
                    </div>
                ))}
            </div>

            {/* Learners */}
            <div className={styles.learners}>
                250K+ learners already on their journey
            </div>

            {/* Rating */}
            <div className={styles.rating}>
                <span className={styles.score}>4.9</span>
                <div className={styles.stars}>★★★★★</div>
            </div>
        </div>
    );
}
