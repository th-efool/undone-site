import type { ReplyContext } from '../../../models/message';
import { MessageComposer } from '../MessageComposer';
import styles from '../MessageComposer.module.css';

interface Props {
  value: string;
  onChange(value: string): void;
  onSend(): void;
  onUpload(file: File, kind: 'image' | 'pdf' | 'file' | 'video' | 'audio'): void;
  /** Batch C: Inline reply banner */
  replyBanner?: ReplyContext | null;
  onReplyDismiss?(): void;
  /** Batch C: Dynamic placeholder */
  channelName?: string;
}

const defaultPlaceholder = 'Message in #general';

export function CommunityComposer({ channelName, ...props }: Props) {
  return (
    <MessageComposer
      {...props}
      placeholder={`Message in #${channelName ?? 'general'}`}
      autoFocusWhenEmpty
      sendButtonClassName={styles.sendButton}
    />
  );
}
