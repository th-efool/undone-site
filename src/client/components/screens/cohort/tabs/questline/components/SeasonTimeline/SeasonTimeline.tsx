import type { Season } from "../../../../models";
import { LessonList } from "../LessonList/LessonList";
import { SeasonCard } from "../SeasonCard/SeasonCard";
import { SeasonSummary } from "../SeasonSummary/SeasonSummary";

import styles from "./SeasonTimeline.module.css";

interface SeasonTimelineProps {
    seasons: Season[];
}

export function SeasonTimeline({ seasons }: SeasonTimelineProps) {
    return (
        <div className={styles.timeline}>
            {seasons.map((season) => (
                <section key={season.id} className={styles.season}>
                    <SeasonCard season={season} />
                    <div className={styles.lessonsColumn}>
                        <LessonList lessons={season.lessons} />
                        <SeasonSummary label={season.summaryLabel} lockedMessage={season.lockedMessage} />
                    </div>
                </section>
            ))}
        </div>
    );
}
