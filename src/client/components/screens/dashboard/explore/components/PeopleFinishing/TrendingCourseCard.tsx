import {
    Flame,
    Star,
} from "lucide-react";

import type { TrendingCourse } from "../../models";

import styles from "./TrendingCourseCard.module.css";
import { ProviderBadge } from "@/src/client/components/global/ProviderBadge";

export interface TrendingCourseCardProps {
    item: TrendingCourse;
}

export function TrendingCourseCard({
                                       item,
                                   }: TrendingCourseCardProps) {

    return (
        <article
            className={styles.card}
        >

            <img
                src={item.thumbnail}
                alt=""
                className={styles.thumbnail}
            />

            <div className={styles.overlay} />

            <div className={styles.topBadges}>

                <div className={styles.trendingBadge}>
                    <Flame
                        size={12}
                        fill="currentColor"
                    />

                    Trending
                </div>

                <div className={styles.durationBadge}>
                    {item.durationLabel}
                </div>

            </div>

            <div className={styles.bottom}>

                <h3 className={styles.title}>
                    {item.title}
                </h3>

                <ProviderBadge
                    provider={item.provider}
                    label="Imported from"
                />


                <div className={styles.footer}>

                    <div className={styles.social}>

                        <div className={styles.avatars}>
                            {item.featuredLearners.map(
                                (learner) => (
                                    <img
                                        key={learner.id}
                                        src={learner.image}
                                        alt=""
                                        className={styles.avatar}
                                    />
                                ),
                            )}
                        </div>

                        <span className={styles.learners}>
                            {item.learnerCount}
                        </span>

                        <span className={styles.rating}>
                            <Star
                                size={12}
                                fill="currentColor"
                            />

                            {item.rating}
                        </span>

                    </div>

                    <button
                        className={styles.join}
                        type="button"
                    >
                        Join
                    </button>

                </div>

            </div>

        </article>
    );
}