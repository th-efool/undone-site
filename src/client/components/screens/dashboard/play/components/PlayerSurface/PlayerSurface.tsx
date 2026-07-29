import { JSX, PropsWithChildren } from 'react';

import styles from './PlayerSurface.module.css';

export function PlayerSurface({ children }: PropsWithChildren): JSX.Element {
  return <div className={styles.surface}>{children}</div>;
}
