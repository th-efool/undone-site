import type { ReplyContext } from '../../../models/message';
import { MessageComposer } from '../MessageComposer';
import styles from './DMComposer.module.css';

interface Props {
  value: string;
  onChange(value: string): void;
  onSend(): void;
  onUpload(file: File, kind: 'image' | 'pdf' | 'file' | 'video' | 'audio'): void;
  /** Batch C: Inline reply banner */
  replyBanner?: ReplyContext | null;
  onReplyDismiss?(): void;
  /** Batch C: Dynamic placeholder — recipient name */
  userName?: string;
}

export function DMComposer({ userName, ...props }: Props) {
  return (
    <MessageComposer
      {...props}
      placeholder={`Say something to ${userName ?? 'someone'}…`}
      submitInsideInput
      inputClassName={styles.input}
    />
  );
}
