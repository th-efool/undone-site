import {
  Star,
  Drama,
  Palette,
  Handshake,
  Landmark,
  Film,
  Utensils,
  Zap,
  Smile,
  Music,
  Mountain,
  Atom,
  Dumbbell,
  BookOpen,
  Cpu,
  HelpCircle,
} from 'lucide-react';
import clsx from 'clsx';
import styles from './TopicChip.module.css';

import type { Topic } from '../../models';

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  trending: Star,
  acting: Drama,
  design: Palette,
  business: Handshake,
  community: Landmark,
  film: Film,
  food: Utensils,
  games: Zap,
  health: Smile,
  music: Music,
  outdoor: Mountain,
  science: Atom,
  sports: Dumbbell,
  writing: BookOpen,
  it: Cpu,
};

export interface TopicChipProps {
  item: Topic;
}

export function TopicChip({ item }: TopicChipProps) {
  const IconComponent = iconMap[item.icon] || HelpCircle;

  return (
    <button
      type="button"
      className={clsx(styles.chip, item.id === 'trending' && styles.trending)}
    >
      <div
        className={styles.icon}
        style={{
          color: item.color,
        }}
      >
        <IconComponent size={18} />
      </div>

      <span className={styles.label}>{item.name}</span>
    </button>
  );
}
