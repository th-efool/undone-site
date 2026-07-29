import styles from './authDivider.module.css';

export function AuthDivider() {
  return (
    <div
      className={styles.divider}
      role="separator"
      aria-label="or continue with email"
    >
      <span className={styles.line} />

      <span className={styles.text}>OR</span>

      <span className={styles.line} />
    </div>
  );
}
