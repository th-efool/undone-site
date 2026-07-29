import { DMReaction } from '../../../../models';
import styles from './MessageReaction.module.css';
interface Props {
  reactions?: DMReaction[];
  outgoing?: boolean;
}
export function MessageReaction({ reactions, outgoing }: Props) {
  if (!reactions?.length) return null;
  return (
    <div className={`${styles.reactions} ${outgoing ? styles.outgoing : ''}`}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
        >
          {reaction.emoji} <span>{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
