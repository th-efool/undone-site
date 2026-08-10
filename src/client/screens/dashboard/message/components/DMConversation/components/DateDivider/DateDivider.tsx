import styles from './DateDivider.module.css';
interface Props {
  label: string;
}
export function DateDivider({ label }: Props) {
  return (
    <div className={styles.divider}>
      <span>{label}</span>
    </div>
  );
}
