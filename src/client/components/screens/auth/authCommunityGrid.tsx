import styles from "./authCommunityGrid.module.css";
import { STUDY_ROOMS } from "./authData";

export default function AuthCommunityGrid() {
    return (
        <div className={styles.grid}>
            {STUDY_ROOMS.map((room) => (
                <article
                    key={room.id}
                    className={styles.card}
                >
                    <video
                        className={styles.video}
                        src={room.video}
                        autoPlay
                        muted
                        loop
                        playsInline
                    />

                    <div className={styles.overlay} />

                    <div className={styles.topRow}>
                        <div className={styles.roomName}>
                            {room.roomName}
                        </div>

                        <div className={styles.members}>
                            👥 {room.members}
                        </div>
                    </div>

                    <div className={styles.bottom}>
                        <div className={styles.name}>
                            {room.learnerName}
                        </div>

                        <div className={styles.activity}>
                            {room.activity}
                        </div>

                        <div className={styles.liveRow}>
                            <span className={styles.liveDot} />

                            <span>Live</span>
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
}