import type { CohortQuestline } from "../../../../models";
import { FeedCard } from "../FeedCard/FeedCard";
import { LockedFutureNotice } from "../LockedFutureNotice/LockedFutureNotice";
import { QuestlineIcon } from "../QuestlineIcon/QuestlineIcon";

import styles from "./AssignmentsProjectsFeed.module.css";

interface AssignmentsProjectsFeedProps {
    questline: CohortQuestline;
}

export function AssignmentsProjectsFeed({ questline }: AssignmentsProjectsFeedProps) {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{questline.feedTitle}</h2>
                        <p className={styles.description}>{questline.feedDescription}</p>
                    </div>
                    <button className={styles.seasonButton} type="button">
                        {questline.feedSeasonLabel}
                        <QuestlineIcon icon="chevronDown" size={15} />
                    </button>
                </div>

                <div className={styles.feedList}>
                    {questline.assignmentFeed.map((item) => (
                        <FeedCard key={item.id} item={item} />
                    ))}
                </div>

                <button className={styles.viewAllButton} type="button">
                    {questline.feedViewAllLabel}
                    <QuestlineIcon icon="chevronDown" size={16} />
                </button>
            </div>

            <LockedFutureNotice notice={questline.lockedFutureNotice} />
        </aside>
    );
}
