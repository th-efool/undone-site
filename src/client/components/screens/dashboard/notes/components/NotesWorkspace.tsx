/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, MoreHorizontal, PanelLeftClose, Share } from 'lucide-react';
import { CanvasSwitcher, Empty, Menu } from './NotesComponents';
import { NotesCanvas } from './NotesCanvas/NotesCanvas';
import { NotesSaveStatus } from './NotesSaveStatus/NotesSaveStatus';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
import styles from '../Notes.module.css';
import type { useNotes } from '../hooks/useNotes';
import type { useNotesNavigation } from '../hooks/useNotesNavigation';
import type { NoteDocument } from '../models/notes.models';

type NotesContextType = ReturnType<typeof useNotes>;
type NavigationType = ReturnType<typeof useNotesNavigation>;

interface NotesWorkspaceProps {
  notes: NotesContextType;
  navigation: NavigationType;
  isMobile: boolean;
  selected: NoteDocument | null;
  menu: string | null;
  setMenu: (m: string | null) => void;
  shareOpen: boolean;
  setShareOpen: (o: boolean) => void;
  canvasSwitcherOpen: boolean;
  setCanvasSwitcherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  canvasLoading: boolean;
  canvasState: any;
  initialScene: any;
  handleSceneChange: any;
}

export function NotesWorkspace({
  notes,
  navigation,
  isMobile,
  selected,
  menu,
  setMenu,
  setShareOpen,
  canvasSwitcherOpen,
  setCanvasSwitcherOpen,
  canvasLoading,
  canvasState,
  initialScene,
  handleSceneChange,
}: NotesWorkspaceProps) {
  const { mobileView, setMobileView, isPanelOpen, setIsPanelOpen } = navigation;

  return (
    <section className={`${styles.workspace} ${isMobile && mobileView !== 'workspace' ? styles.workspaceHidden : ''}`}>
      <header className={styles.topbar}>
        {isMobile && (
          <button
            className={styles.mobileBackBtn}
            onClick={() => setMobileView('panel')}
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
        {!isMobile && !isPanelOpen && (
          <button
            className={styles.mobileBackBtn}
            onClick={() => setIsPanelOpen(true)}
            aria-label="Open sidebar"
            title="Open sidebar"
            style={{ padding: '6px', marginRight: '4px' }}
          >
            <PanelLeftClose size={16} style={{ transform: 'scaleX(-1)' }} />
          </button>
        )}
        <div className={styles.crumb}>
          <strong>{notes.data?.selectedNotebook?.title ?? 'Notebook'}</strong>
          <span className={styles.crumbSeparator}>/</span>
          <CanvasSwitcher
            open={canvasSwitcherOpen}
            onToggle={(event) => {
              event.stopPropagation();
              setCanvasSwitcherOpen((open) => !open);
            }}
            onClose={() => setCanvasSwitcherOpen(false)}
            notes={
              notes.data?.selectedNotebook && notes.state
                ? notes.state.notes.filter(
                    (note) =>
                      note.notebookId === notes.data!.selectedNotebook!.id && !note.archived,
                  )
                : []
            }
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              notes.actions.selectNote(id);
              setCanvasSwitcherOpen(false);
            }}
            title={selected?.title}
            onTitleChange={(newTitle) => {
              if (selected) {
                notes.actions.patchNote(selected.id, { title: newTitle });
              }
            }}
          />
          {selected && <NotesSaveStatus state={canvasState} />}
        </div>
        <div className={styles.actions}>
          <Tooltip content={<>Share <kbd className={styles.kbd}>O</kbd></>} placement="bottom">
            <button className={styles.topbarBtn} onClick={() => setShareOpen(true)}>
              <Share size={15} />
              <span>Share</span>
            </button>
          </Tooltip>
          <Tooltip content="More options" placement="bottom">
            <button
              className={styles.moreBtn}
              aria-label="More options"
              onClick={(e) => {
                e.stopPropagation();
                setMenu('more');
              }}
            >
              <MoreHorizontal size={17} />
            </button>
          </Tooltip>
          {menu === 'more' && (
            <Menu>
              <button onClick={() => selected && notes.actions.duplicateNote(selected.id)}>
                Duplicate note
              </button>
              <button onClick={() => selected && notes.actions.archiveNote(selected.id)}>
                {selected?.archived ? 'Restore note' : 'Archive note'}
              </button>
              <button onClick={() => selected && notes.actions.deleteNote(selected.id)}>
                Delete note
              </button>
            </Menu>
          )}
        </div>
      </header>
      
      <article className={styles.canvas}>
        {!selected ? (
          <Empty
            label={notes.data?.selectedNotebook ? 'No notes in this notebook' : 'No notebook selected'}
            action="New note"
            onClick={() => notes.actions.createNote()}
          />
        ) : canvasLoading ? (
          <div className={styles.loadingScene}>Loading canvas...</div>
        ) : (
          <NotesCanvas
            key={selected.id}
            noteId={selected.id}
            initialScene={initialScene}
            onSceneChange={handleSceneChange}
          />
        )}
      </article>
    </section>
  );
}
