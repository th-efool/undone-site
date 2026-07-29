/* eslint-disable @next/next/no-img-element */
import { ArrowDown } from 'lucide-react';
import { ReplyPreviewModel } from '../../../../models';
import styles from './ReplyPreview.module.css';
interface Props {
  reply: ReplyPreviewModel;
}
export function ReplyPreview({ reply }: Props) {
  return (
    <div className={styles.reply}>
      <ArrowDown size={15} />
      <div>
        {reply.avatars.map((avatar) => (
          <img
            key={avatar.id}
            src={avatar.avatar}
            alt=""
          />
        ))}
      </div>
      <strong>{reply.count} replies</strong>
      <span>
        Last reply by {reply.lastReplyBy} • {reply.timestamp}
      </span>
    </div>
  );
}
