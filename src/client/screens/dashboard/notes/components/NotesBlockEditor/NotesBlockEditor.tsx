import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { useHocuspocusProvider } from '../../hooks/useHocuspocusProvider';
import { withCollaboration } from '@blocknote/core/yjs';
import '@blocknote/mantine/style.css';
import styles from './NotesBlockEditor.module.css';

import { useEffect } from 'react';

interface NotesBlockEditorProps {
  noteId: string;
  onStatusChange?: (status: any) => void;
}

function InnerEditor({ provider }: { provider: any }) {
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        provider,
        fragment: provider.document.getXmlFragment('document-store'),
        user: { name: 'User', color: '#ff0000' },
      },
    })
  );

  return <BlockNoteView editor={editor} theme="dark" />;
}

export function NotesBlockEditor({ noteId, onStatusChange }: NotesBlockEditorProps) {
  const { provider, status } = useHocuspocusProvider(noteId);

  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(status);
    }
  }, [status, onStatusChange]);

  if (!provider) {
    return <div className={styles.loading}>Connecting to editor...</div>;
  }

  return (
    <div className={styles.editorContainer}>
      <InnerEditor provider={provider} />
    </div>
  );
}
