import styles from './TypingIndicator.module.css';

interface Props {
  usernames: string[];
}

export function TypingIndicator({ usernames }: Props) {
  if (usernames.length === 0) return null;

  // Show up to 2 names, then "+n" for the rest
  const displayNames = usernames.slice(0, 2);
  const remaining = Math.max(0, usernames.length - 2);

  let label: string;
  if (displayNames.length === 1) {
    label = `${displayNames[0]} is typing`;
  } else {
    label = displayNames.join(' and ') + ` typing`;
    if (remaining > 0) {
      label += ` +${remaining}`;
    }
  }

  return (
    <div className={styles.container}>
      <span>{label}</span>
      <span className={styles.dots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
    </div>
  );
}
