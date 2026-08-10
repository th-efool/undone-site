import styles from '../../Archives.module.css';

export function ArchiveVoting({ count }: { count: number }) {
  return (
    <div className={styles.votes}>
      <button>⌃</button>
      <strong>{count}</strong>
      <button>⌄</button>
    </div>
  );
}
