import type { StartingPoint as StartingPointValue } from '@/src/shared/cohort-creation/contracts';
import styles from '../CreationExperience.module.css';

const choices: { value: StartingPointValue; label: string }[] = [
  { value: 'have_material', label: 'I already have material' },
  { value: 'find_material', label: 'Find material for me' },
  { value: 'have_goal', label: 'I just have a goal' },
];
export function StartingPoint({ selected, onSelect, onBack }: { selected: StartingPointValue | null; onSelect: (choice: StartingPointValue) => void; onBack: () => void }) {
  return <section aria-label="Starting point">
    <h2>What are you starting with?</h2>
    <div className={styles.cards}>
      {choices.map(choice => <button key={choice.value} type="button" aria-pressed={selected === choice.value} onClick={() => onSelect(choice.value)}>{choice.label}</button>)}
    </div>
    {selected && <p role="status">Starting point saved to your account. Material acquisition will be added in the next implementation phase.</p>}
    <button type="button" onClick={onBack}>Back to recommendations</button>
  </section>;
}
