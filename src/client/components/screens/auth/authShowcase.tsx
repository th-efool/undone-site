import styles from "./authShowcase.module.css";
import AuthCommunityGrid from "./authCommunityGrid";
import AuthFeaturedContent from "./authFeaturedContent";
import { AuthPhone } from "./authPhone";

export default function AuthShowcase() {
    return (
        <div className={styles.showcase}>

            <header className={styles.header}>
                <div className={styles.heading}>
                    Join a Community of{" "}
                    <span className={styles.highlight}>
                        Curious Minds
                    </span>
                </div>

                <p className={styles.description}>
                    Your next favorite people probably aren&#39;t on your social feed.
                </p>
            </header>

            <div className={styles.community}>
                <AuthCommunityGrid />
            </div>

            <div className={styles.featured}>
                <AuthFeaturedContent />
            </div>

            <AuthPhone />

        </div>
    );
}