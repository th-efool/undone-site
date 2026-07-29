import { MessageComposer } from '../MessageComposer';
import styles from '../MessageComposer.module.css';

interface Props {
  value: string;
  onChange(value: string): void;
  onSend(): void;
  onUpload(file: File, kind: 'image' | 'pdf' | 'file' | 'video' | 'audio'): void;
}

export function CommunityComposer(props: Props) {
  return (
    <MessageComposer
      {...props}
      placeholder="Message #general"
      autoFocusWhenEmpty
      sendButtonClassName={styles.sendButton}
    />
  );
}
