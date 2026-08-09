import React from 'react';
import styles from '../Notes.module.css';
import { ChevronDown, Link, MoreHorizontal } from 'lucide-react';

export const SpaceHeader = () => (
  <div className={styles.spaceHeaderContainer}>
    <div className={styles.spaceHeaderLeft}>
      <div className={styles.spaceHeaderIcon}>
        <div className={styles.spaceHeaderImgPlaceholder}></div>
      </div>
      <div className={styles.spaceHeaderTitleWrap}>
        <h1 className={styles.spaceHeaderTitle}>Any<br />Possibilities</h1>
        <ChevronDown size={14} className={styles.spaceHeaderChevron} />
      </div>
    </div>
    <div className={styles.spaceHeaderRight}>
    </div>
  </div>
);
