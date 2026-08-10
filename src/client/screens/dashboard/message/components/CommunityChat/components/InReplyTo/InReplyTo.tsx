/* eslint-disable @next/next/no-img-element */
import styles from './InReplyTo.module.css';

interface Props {
  messageId?: string;
  authorName: string;
  authorAvatar: string;
  previewText: string;
  onHoverChange?: (hovered: boolean) => void;
}

/**
 * Renders a compact bubble container preview for non-adjacent message replies.
 * Displays author handle + preview text inside a subtle rounded container box.
 * Clickable to jump to original message.
 */
export function InReplyTo({
  messageId,
  authorName,
  previewText,
  onHoverChange,
}: Props) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!messageId) return;
    const targetElement = document.getElementById(`msg-${messageId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetElement.classList.add(styles.highlight);
      setTimeout(() => targetElement.classList.remove(styles.highlight), 1500);
    }
  };

  return (
    <div
      className={styles.replyBubble}
      onClick={handleClick}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      role="button"
      tabIndex={0}
      title="Click to jump to original message"
    >
      <span className={styles.author}>{authorName}</span>
      <span className={styles.preview}>{previewText}</span>
    </div>
  );
}
