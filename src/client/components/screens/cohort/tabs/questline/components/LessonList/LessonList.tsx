import type { Lesson } from "../../../../models";
import { LessonRow } from "../LessonRow/LessonRow";

import styles from "./LessonList.module.css";

interface LessonListProps {
    lessons: Lesson[];
}

export function LessonList({ lessons }: LessonListProps) {
    return (
        <div className={styles.list}>
            {lessons.map((lesson, index) => (
                <LessonRow key={lesson.id} lesson={lesson} index={index} />
            ))}
        </div>
    );
}
