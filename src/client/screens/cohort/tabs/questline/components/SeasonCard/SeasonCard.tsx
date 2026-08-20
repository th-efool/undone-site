import { useState } from 'react';
import { SeasonStatus, type Season } from '../../../../models';
import { QuestlineIcon } from '../QuestlineIcon/QuestlineIcon';

import styles from './SeasonCard.module.css';

interface SeasonCardProps {
  season: Season;
}

export function SeasonCard({ season }: SeasonCardProps) {
  const [status, setStatus] = useState<SeasonStatus>(season.status);
  const isLocked = status === SeasonStatus.Locked;

  return (
    <aside className={`${styles.card} ${isLocked ? styles.locked : ''}`}>
      <div className={styles.headerRow}>
        <div className={styles.badge}>{season.badge}</div>
        <div className={`${styles.statusDropdownWrapper} ${styles[status]}`}>
          <QuestlineIcon
            icon={status === SeasonStatus.Completed ? 'check' : status === SeasonStatus.Locked ? 'lock' : 'circle'}
            size={12}
            className={styles.statusIcon}
          />
          <select
            className={styles.statusSelect}
            value={status}
            onChange={(e) => setStatus(e.target.value as SeasonStatus)}
            aria-label="Change Season Status"
          >
            <option value={SeasonStatus.InProgress}>In Stream</option>
            <option value={SeasonStatus.Completed}>Completed</option>
            <option value={SeasonStatus.Paused}>Paused</option>
            <option value={SeasonStatus.Locked}>Locked</option>
          </select>
          <QuestlineIcon icon="chevronDown" size={14} className={styles.selectChevron} />
        </div>
      </div>
      <h3 className={styles.title}>{season.title}</h3>
      <p className={styles.meta}>
        {season.questCount} quests • {season.estimatedDuration}
      </p>

      {isLocked ? (
        <div className={styles.lockedState}>
          <QuestlineIcon
            icon="lock"
            size={15}
          />{' '}
          Locked
        </div>
      ) : (
        <div className={styles.progressBlock}>
          <div className={styles.progressLabel}>{season.progress}% complete</div>
          <progress
            className={styles.track}
            value={season.progress}
            max={100}
          />
          <div className={styles.progressValue}>{season.progress}%</div>
        </div>
      )}
    </aside>
  );
}
