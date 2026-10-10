import { Check } from 'lucide-react';
import styles from './UnderstandingProgress.module.css';

export function ProcessingSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return <ol className={styles.steps} aria-label="Creation progress">{['Understanding', 'Chunking', 'Analyzing', 'Building'].map((label, index) =>
    <li key={label} aria-current={index === current ? 'step' : undefined} data-complete={index < current}>
      <span>{index < current ? <Check size={16} aria-label="Complete" /> : index + 1}</span>{label}
    </li>)}</ol>;
}
