import React from 'react';
import styles from './loading.module.css';

export default function StudyRoomLoading() {
  return (
    <main>
      <div className={styles.stage} aria-busy="true">
        <span className={styles.srOnly}>Entering room</span>
      </div>
    </main>
  );
}
