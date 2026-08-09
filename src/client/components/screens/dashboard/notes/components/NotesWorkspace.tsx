import { ArrowLeft, MoreHorizontal, PanelLeftOpen, Menu as MenuIcon, Share } from 'lucide-react';
import { CanvasSwitcher, Menu } from './NotesComponents';
import { NotesCanvas } from './NotesCanvas/NotesCanvas';
import { NotesKanban } from './NotesKanban/NotesKanban';
import { NotesSaveStatus } from './NotesSaveStatus/NotesSaveStatus';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
import styles from '../Notes.module.css';
import sidebarStyles from './NotesSidebar.module.css';
import type { useNotes } from '../hooks/useNotes';
import type { useNotesNavigation } from '../hooks/useNotesNavigation';
import type { NoteDocument } from '../models/notes.models';
import type { CanvasSceneData, CanvasState } from '../models/canvas.models';

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
  canvasState: CanvasState;
  initialScene: CanvasSceneData | null;
  handleSceneChange: (scene: CanvasSceneData) => void;
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
  const { mobileView, setMobileView, isNavigationExpanded, setIsNavigationExpanded, isWorkspaceExpanded, setIsWorkspaceExpanded } = navigation;

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
        {!isMobile && (!isNavigationExpanded || !isWorkspaceExpanded) && (
          <div style={{ display: 'flex', gap: '8px', marginRight: '8px', alignItems: 'center' }}>
            {!isNavigationExpanded && !isWorkspaceExpanded && (
              <button
                className={sidebarStyles.iconButton}
                onClick={() => setIsNavigationExpanded(true)}
                aria-label="Open navigation panel"
                title="Open navigation"
                style={{ padding: '6px', color: '#f1f5f9' }}
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            {!isWorkspaceExpanded && (
              <button
                className={sidebarStyles.iconButton}
                onClick={() => setIsWorkspaceExpanded(true)}
                aria-label="Open workspace panel"
                title="Open workspace"
                style={{ padding: '6px', color: '#f1f5f9' }}
              >
                <MenuIcon size={18} />
              </button>
            )}
          </div>
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
      
      {!selected ? (
        <article className={styles.overview}>
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', paddingBottom: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#a1a1aa' }}>
            Select a note to view canvas
          </div>
        </article>
      ) : selected.contentType === 'kanban' ? (
        <article className={styles.canvas}>
          <NotesKanban key={selected.id} noteId={selected.id} />
        </article>
      ) : (
        <article className={styles.canvas}>
          {canvasLoading ? (
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
      )}
    </section>
  );
}
