/* eslint-disable @next/next/no-img-element */
import { FileImage, FileText, Video } from 'lucide-react';
import { RecentMessage } from '../../../models';
import styles from './RecentMessageItem.module.css';
interface Props {
  message: RecentMessage;
}

/** Detect attachment type from filename extension */
function getAttachmentIcon(attachment: string): 'pdf' | 'image' | 'video' | 'file' {
  const ext = attachment.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'file';
}

export function RecentMessageItem({ message }: Props) {
  return (
    <article className={styles.row}>
      <span className={styles.avatar}>
        <img
          src={message.sender.avatar}
          alt=""
        />
        {message.sender.online && <i />}
      </span>
      <div className={styles.body}>
        <div className={styles.top}>
          <strong>{message.sender.name}</strong>
          <span>{message.community}</span>
        </div>
        {message.attachment ? (() => {
          const type = getAttachmentIcon(message.attachment);
          return (
            <div className={styles.file} data-attachment-type={type}>
              {type === 'pdf' && <FileText size={16} />}
              {type === 'image' && <FileImage size={16} />}
              {type === 'video' && <Video size={16} />}
              {(type === 'file') && <FileText size={16} />}
              {message.attachment}
            </div>
          );
        })() : (
          <p>{message.message}</p>
        )}
      </div>
      <div className={styles.meta}>
        {message.timestamp && <time>{message.timestamp}</time>}
        {message.unreadCount && <b>{message.unreadCount}</b>}
      </div>
    </article>
  );
}
