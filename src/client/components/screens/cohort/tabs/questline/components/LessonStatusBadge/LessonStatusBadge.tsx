import { LessonStatus } from "../../../../models";
import { QuestlineIcon } from "../QuestlineIcon/QuestlineIcon";

import styles from "./LessonStatusBadge.module.css";

interface LessonStatusBadgeProps {
    status: LessonStatus;
}

const statusConfig = {
    [LessonStatus.Completed]: {
        label: "Completed",
        icon: "check",
        className: styles.completed,
    },
    [LessonStatus.InStream]: {
        label: "In Stream",
        icon: "circle",
        className: styles.inProgress,
    },
    [LessonStatus.Ready]: {
        label: "Ready to Start",
        icon: "target",
        className: styles.ready,
    },
    [LessonStatus.Locked]: {
        label: "Locked",
        icon: "lock",
        className: styles.locked,
    },
} as const;

export function LessonStatusBadge({ status }: LessonStatusBadgeProps) {
    const config = statusConfig[status];

    return (
        <span className={`${styles.badge} ${config.className}`}>
            <QuestlineIcon icon={config.icon} size={16} />
            <span>{config.label}</span>
        </span>
    );
}
