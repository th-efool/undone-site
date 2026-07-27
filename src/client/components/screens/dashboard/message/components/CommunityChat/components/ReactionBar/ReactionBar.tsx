import { ChatReaction } from "../../../../models";
import styles from "./ReactionBar.module.css";
interface Props { reactions?: ChatReaction[]; }
export function ReactionBar({ reactions }: Props) {if (!reactions?.length) return null; return <div className={styles.reactions}>{reactions.map((reaction) => <button key={reaction.emoji} type="button">{reaction.emoji} <span>{reaction.count}</span></button>)}</div>}
