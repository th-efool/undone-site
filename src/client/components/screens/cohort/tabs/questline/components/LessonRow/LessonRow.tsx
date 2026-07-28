import Image from "next/image";

import { LessonStatus, type Lesson } from "../../../../models";
import { LessonStatusBadge } from "../LessonStatusBadge/LessonStatusBadge";
import { LessonTypeBadge } from "../LessonTypeBadge/LessonTypeBadge";
import { QuestlineIcon } from "../QuestlineIcon/QuestlineIcon";

import styles from "./LessonRow.module.css";

interface LessonRowProps {
    lesson: Lesson;
    index: number;
}

export function LessonRow({ lesson, index }: LessonRowProps) {
    const isLocked = lesson.status === LessonStatus.Locked;

    return (
        <article className={`${styles.row} ${isLocked ? styles.locked : ""}`}>
            <Image src={lesson.thumbnail} alt="" width={96} height={56} className={styles.thumbnail} />

            <div className={styles.content}>
                <h3 className={styles.title}>{index + 1}. {lesson.title}</h3>
                <div className={styles.meta}>
                    <LessonTypeBadge type={lesson.type} />
                    <span>{lesson.duration}</span>
                </div>
            </div>

            <LessonStatusBadge status={lesson.status} />

            <button className={styles.expandButton} type="button" aria-label="Expand lesson">
                <QuestlineIcon icon={isLocked ? "lock" : "chevronDown"} size={16} />
            </button>
        </article>
    );
}
