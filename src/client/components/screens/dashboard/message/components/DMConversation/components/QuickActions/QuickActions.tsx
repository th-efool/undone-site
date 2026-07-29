import { MoreHorizontal, Phone, Video } from 'lucide-react';
import styles from './QuickActions.module.css';
const actions = [
  { label: 'Video', Icon: Video },
  { label: 'Call', Icon: Phone },
  { label: 'More', Icon: MoreHorizontal },
];
export function QuickActions() {
  return (
    <div className={styles.actions}>
      {actions.map(({ label, Icon }) => (
        <button
          key={label}
          type="button"
        >
          <Icon size={24} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
