import type { TimelineMarker } from "../../types/play";

import styles from "./LearningTimeline.module.css";

export interface LearningTimelineProps {
    progress: number;

    markers: TimelineMarker[];

    className?: string;
}

export function LearningTimeline({
                                     progress,
                                     markers,
                                     className,
                                 }: LearningTimelineProps) {
    return (
        <div className={`${styles.timeline} ${className ?? ""}`}>
            <div className={styles.track}>
                <div
                    className={styles.progress}
                    style={{
                        width: `${progress}%`,
                    }}
                />

                {markers.map((marker) => (
                    <span
                        key={marker.id}
                        className={`${styles.marker} ${styles[marker.variant]} ${
                            marker.active ? styles.active : ""
                        }`}
                        style={{
                            left: `${marker.position}%`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}