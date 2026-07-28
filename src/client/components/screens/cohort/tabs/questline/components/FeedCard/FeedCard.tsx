import Image from "next/image";

import type { AssignmentFeedItem } from "../../../../models";
import { LessonTypeBadge } from "../LessonTypeBadge/LessonTypeBadge";
import { QuestlineIcon } from "../QuestlineIcon/QuestlineIcon";

import styles from "./FeedCard.module.css";

interface FeedCardProps {
    item: AssignmentFeedItem;
}

export function FeedCard({ item }: FeedCardProps) {
    return (
        <article className={styles.card}>
            <Image src={item.thumbnail} alt="" width={96} height={76} className={styles.thumbnail} />

            <div className={styles.content}>
                <div className={styles.header}>
                    <h3 className={styles.title}>{item.title}</h3>
                    <span className={styles.iconBadge}><QuestlineIcon icon={item.icon} size={15} /></span>
                </div>

                <div className={styles.meta}>
                    <LessonTypeBadge type={item.type} />
                    <span>{item.duration}</span>
                </div>

                <p className={styles.description}>{item.description}</p>

                <div className={styles.footer}>
                    <div className={styles.submissions}>
                        <div className={styles.avatars}>
                            {item.participants.map((participant) => (
                                <Image
                                    key={participant.id}
                                    src={participant.avatarUrl}
                                    alt=""
                                    width={22}
                                    height={22}
                                    className={styles.avatar}
                                />
                            ))}
                        </div>
                        <span>{item.submittedCount}</span>
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.secondaryButton} type="button">{item.shareLabel}</button>
                        <button className={styles.primaryButton} type="button">{item.doneLabel}</button>
                    </div>
                </div>
            </div>
        </article>
    );
}
