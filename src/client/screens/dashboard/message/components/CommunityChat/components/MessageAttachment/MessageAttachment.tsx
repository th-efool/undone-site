import Image from 'next/image';
/* eslint-disable @next/next/no-img-element */
import { Download, FileText, Play } from 'lucide-react';
import { ChatAttachment } from '../../../../models';
import styles from './MessageAttachment.module.css';

interface Props {
  attachment: ChatAttachment;
  compact?: boolean;
}
export function MessageAttachment({ attachment, compact }: Props) {
  if (attachment.kind === 'pdf')
    return (
      <article className={styles.file}>
        <span>
          <FileText size={20} />
        </span>
        <div className={styles.fileContent}>
          <strong title={attachment.title}>{attachment.title}</strong>
          <p>{attachment.meta}</p>
        </div>
        <button
          type="button"
          aria-label="Download"
        >
          <Download size={16} />
        </button>
      </article>
    );
  return (
    <figure className={`${styles.image} ${compact ? styles.compact : ''}`}>
      <Image width={400} height={300} src={attachment.url || ''} alt={attachment.title || ''} />
      {attachment.duration && (
        <em>
          <Play
            size={14}
            fill="currentColor"
          />{' '}
          {attachment.duration}
        </em>
      )}
      {!compact && attachment.caption && (
        <figcaption>
          {attachment.caption}
          <span>{attachment.meta}</span>
        </figcaption>
      )}
    </figure>
  );
}
