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

// Override BlockNote's dark theme — pure #000000, no grey box
const PURE_BLACK_THEME = {
  colors: {
    editor: {
      text: '#f1f5f9',
      background: '#000000',
    },
    menu: {
      text: '#e2e8f0',
      background: '#111111',
    },
    tooltip: {
      text: '#e2e8f0',
      background: '#111111',
    },
    hovered: {
      text: '#f1f5f9',
      background: '#1a1a1a',
    },
    selected: {
      text: '#ffffff',
      background: '#4f46e5',
    },
    disabled: {
      text: '#52525b',
      background: '#000000',
    },
    shadow: '#000000',
    border: '#27272a',
    sideMenu: '#52525b',
    highlights: {
      gray:   { text: '#a1a1aa', background: 'rgba(161,161,170,0.08)' },
      brown:  { text: '#a78060', background: 'rgba(120,80,40,0.12)' },
      red:    { text: '#f87171', background: 'rgba(248,113,113,0.10)' },
      orange: { text: '#fb923c', background: 'rgba(251,146,60,0.10)' },
      yellow: { text: '#facc15', background: 'rgba(250,204,21,0.10)' },
      green:  { text: '#4ade80', background: 'rgba(74,222,128,0.10)' },
      blue:   { text: '#60a5fa', background: 'rgba(96,165,250,0.10)' },
      purple: { text: '#a78bfa', background: 'rgba(167,139,250,0.10)' },
      pink:   { text: '#f472b6', background: 'rgba(244,114,182,0.10)' },
    },
  },
  borderRadius: 4,
  fontFamily: 'inherit',
} as const;

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

  return <BlockNoteView editor={editor} theme={PURE_BLACK_THEME} />;
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
      <div className={styles.editorInner}>
        <InnerEditor provider={provider} />
      </div>
    </div>
  );
}
