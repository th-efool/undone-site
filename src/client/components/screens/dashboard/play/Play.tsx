import { LessonCard, LearningTimeline, PlaybackControls, PlayerSurface, PlayerToolbar } from "./components";

import styles from "./Play.module.css";

export function Play() {
    return (
        <section className={styles.play}>
            <PlayerSurface />

            <LessonCard />

            <PlayerToolbar />

            <LearningTimeline />

            <PlaybackControls />
        </section>
    );
}