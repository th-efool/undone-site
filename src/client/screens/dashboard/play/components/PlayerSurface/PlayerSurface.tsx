'use client';

import { JSX, PropsWithChildren, RefObject } from 'react';
import styles from './PlayerSurface.module.css';

export interface PlayerSurfaceProps extends PropsWithChildren {
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function PlayerSurface({ children, containerRef }: PlayerSurfaceProps): JSX.Element {
  return (
    <div className={styles.surface}>
      <div className={styles.videoWrapper} ref={containerRef} />
      <div className={styles.surfaceOverlay} />
      <div className={styles.contentWrapper}>{children}</div>
    </div>
  );
}
