import type { LockedFutureNotice as LockedFutureNoticeModel } from '../../../../models';
import { QuestlineIcon } from '../QuestlineIcon/QuestlineIcon';

import styles from './LockedFutureNotice.module.css';

interface LockedFutureNoticeProps {
  notice: LockedFutureNoticeModel;
}

export function LockedFutureNotice({ notice }: LockedFutureNoticeProps) {
  return (
    <aside className={styles.notice}>
      <QuestlineIcon
        icon={notice.icon}
        className={styles.icon}
      />
      <div>
        <h3 className={styles.title}>{notice.title}</h3>
        <p className={styles.description}>{notice.description}</p>
      </div>
    </aside>
  );
}
