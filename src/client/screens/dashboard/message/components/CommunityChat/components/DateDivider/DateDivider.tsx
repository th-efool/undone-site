import styles from './DateDivider.module.css';

interface Props {
  dateLabel: string;
}

export function DateDivider({ dateLabel }: Props) {
  return (
    <div className={styles.divider}>
      <span>{dateLabel}</span>
    </div>
  );
}
