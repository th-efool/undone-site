import { LessonType } from '../../../../models';
import { QuestlineIcon, type QuestlineUtilityIcon } from '../QuestlineIcon/QuestlineIcon';

import styles from './LessonTypeBadge.module.css';

interface LessonTypeBadgeProps {
  type: LessonType;
}

const typeConfig = {
  [LessonType.Video]: {
    label: 'Video',
    icon: 'play',
    className: styles.video,
  },
  [LessonType.Reading]: {
    label: 'Blog',
    icon: 'book',
    className: styles.reading,
  },
  [LessonType.Assignment]: {
    label: 'Assignment',
    icon: 'assignment',
    className: styles.assignment,
  },
  [LessonType.Project]: {
    label: 'Project',
    icon: 'project',
    className: styles.project,
  },
  [LessonType.Quiz]: {
    label: 'Quiz',
    icon: 'check',
    className: styles.quiz,
  },
  [LessonType.Exercise]: {
    label: 'Exercise',
    icon: 'target',
    className: styles.exercise,
  },
} satisfies Record<LessonType, { label: string; icon: QuestlineUtilityIcon; className: string }>;

export function LessonTypeBadge({ type }: LessonTypeBadgeProps) {
  const config = typeConfig[type];

  return (
    <span className={`${styles.badge} ${config.className}`}>
      <QuestlineIcon
        icon={config.icon}
        size={13}
      />
      {config.label}
    </span>
  );
}
