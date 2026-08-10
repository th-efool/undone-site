import { ChatReaction } from '../../../../models';
import styles from './ReactionBar.module.css';

interface Props {
  reactions?: ChatReaction[];
  onReaction(emoji: string): void;
}
export function ReactionBar({ reactions, onReaction }: Props) {
  if (!reactions?.length) return null;
  return (
    <div className={styles.reactions}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          className={reaction.reactedByMe ? styles.selected : ''}
          aria-pressed={Boolean(reaction.reactedByMe)}
          onClick={() => onReaction(reaction.emoji)}
        >
          {reaction.emoji} <span>{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
