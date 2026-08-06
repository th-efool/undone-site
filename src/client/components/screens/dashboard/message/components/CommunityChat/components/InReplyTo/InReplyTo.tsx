/* eslint-disable @next/next/no-img-element */
import styles from './InReplyTo.module.css';

interface Props {
  authorName: string;
  authorAvatar: string;
  previewText: string;
}

/**
 * Renders the "quoted reply" shown ABOVE the message body.
 * Design: left accent bar + faded avatar + faded author name + truncated preview text.
 */
export function InReplyTo({ authorName, authorAvatar, previewText }: Props) {
  return (
    <div className={styles.wrap}>
      <span className={styles.accentLine} aria-hidden="true" />
      <img className={styles.avatar} src={authorAvatar} alt="" />
      <div className={styles.body}>
        <span className={styles.name}>{authorName}</span>
        <span className={styles.preview}>{previewText}</span>
      </div>
    </div>
  );
}
