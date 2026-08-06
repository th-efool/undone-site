import styles from './AvatarConnector.module.css';

interface Props {
  type: 'top' | 'bottom';
  isDM?: boolean;
}

/**
 * Renders a vertical line segment connecting adjacent avatars across variable message heights.
 * type='bottom': extends from bottom of avatar down to bottom edge of message row.
 * type='top': extends from top edge of message row down to top of avatar.
 */
export function AvatarConnector({ type, isDM }: Props) {
  const typeClass = type === 'bottom' ? styles.bottomSegment : styles.topSegment;
  const dmClass = isDM ? styles.dm : '';
  return <div className={`${styles.line} ${typeClass} ${dmClass}`} aria-hidden="true" />;
}
