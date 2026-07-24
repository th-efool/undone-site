import styles from "./authCommunityGrid.module.css";
import { STUDY_ROOMS } from "./authData";

export default function AuthCommunityGrid() {
    return (
        <div className={styles.grid}>

            <div className={styles.row}>
                {STUDY_ROOMS.slice(0, 4).map(renderCard)}
            </div>

            <div className={styles.row}>
                {STUDY_ROOMS.slice(4, 7).map(renderCard)}
            </div>

            <div className={styles.row}>
                {STUDY_ROOMS.slice(7, 9).map(renderCard)}
            </div>

        </div>
    );
}

function renderCard(room: (typeof STUDY_ROOMS)[number]) {
    return (
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
    );
}