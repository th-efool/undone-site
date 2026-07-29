'use client';

import {
  Archive,
  Bold,
  CheckSquare,
  Code,
  Copy,
  Filter,
  Folder,
  Italic,
  Link,
  List,
  ListOrdered,
  Lock,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Presentation,
  Search,
  Share2,
  SortAsc,
  Sparkles,
  Star,
  Type,
  Underline,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotes } from './hooks/useNotes';
import type { NotesFilter, NotesSort } from './models/notes.models';
import {
  CanvasSwitcher,
  Empty,
  IconButton,
  Menu,
  Notebook,
  Section,
  ShareModal,
} from './components/NotesComponents';
import styles from './Notes.module.css';

const sorts: [NotesSort, string][] = [
  ['manual', 'Manual order'],
  ['alphabetical', 'Alphabetical'],
  ['recentlyEdited', 'Recently edited'],
  ['recentlyCreated', 'Recently created'],
  ['oldestFirst', 'Oldest first'],
  ['newestFirst', 'Newest first'],
];
const filters: [NotesFilter, string][] = [
  ['all', 'All notes'],
  ['favorites', 'Favorites'],
  ['recent', 'Recently edited'],
  ['shared', 'Shared'],
  ['archived', 'Archived'],
];

export function Notes() {
  const notes = useNotes();
  const [menu, setMenu] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [canvasSwitcherOpen, setCanvasSwitcherOpen] = useState(false);
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const selected = notes.data?.selectedNote;

  const cmd = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);
  const addLink = useCallback(() => {
    const url = prompt('Paste a link');
    if (url) cmd('createLink', url);
  }, [cmd]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresenting(false);
      if ((e.ctrlKey || e.metaKey) && selected) {
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          document.execCommand('bold');
        }
        if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          document.execCommand('italic');
        }
        if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          addLink();
        }
        if (e.shiftKey && e.key === '7') {
          e.preventDefault();
          document.execCommand('insertOrderedList');
        }
        if (e.shiftKey && e.key === '8') {
          e.preventDefault();
          document.execCommand('insertUnorderedList');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addLink, selected]);
  useEffect(() => {
    if (editorRef.current && selected && editorRef.current.innerHTML !== selected.body)
      editorRef.current.innerHTML = selected.body;
  }, [selected]);
  const coming = () => alert('Coming Soon');
  if (!notes.state || !notes.data) return <main className={styles.loading}>Loading notes…</main>;

  if (presenting)
    return (
      <main
        className={styles.present}
        tabIndex={0}
      >
        <button onClick={() => setPresenting(false)}>Exit presentation</button>
        <article
          dangerouslySetInnerHTML={{
            __html: selected?.body ?? '<h1>No note selected</h1>',
          }}
        />
      </main>
    );

  const counts = {
    favorites:
      notes.state.notebooks.filter((n) => n.favorite && !n.archived).length +
      notes.state.notes.filter((n) => n.favorite && !n.archived).length,
    shared:
      notes.state.notebooks.filter((n) => n.shared && !n.archived).length +
      notes.state.notes.filter((n) => n.shared && !n.archived).length,
    archive:
      notes.state.notebooks.filter((n) => n.archived).length +
      notes.state.notes.filter((n) => n.archived).length,
  };

  return (
    <main
      className={styles.notes}
      onClick={() => {
        setMenu(null);
        setCanvasSwitcherOpen(false);
      }}
    >
      <aside className={styles.panel}>
        <header className={styles.header}>
          <h1>
            Notes <Sparkles size={22} />
          </h1>
          <p>Your thinking, connected.</p>
        </header>
        <div className={styles.toolbar}>
          <IconButton
            label="New notebook"
            onClick={notes.actions.createNotebook}
          >
            <Plus />
          </IconButton>
          <IconButton
            label="New note"
            onClick={() => notes.actions.createNote()}
          >
            <Folder />
          </IconButton>
          <label className={styles.selectControl}>
            <SortAsc size={16} />
            <select
              aria-label="Sort notebooks"
              value={notes.state.notebookSort}
              onChange={(e) => notes.actions.setNotebookSort(e.target.value as NotesSort)}
            >
              {sorts.map(([v, l]) => (
                <option
                  key={v}
                  value={v}
                >
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.selectControl}>
            <Filter size={16} />
            <select
              aria-label="Filter notes"
              value={notes.state.filter}
              onChange={(e) => notes.actions.setFilter(e.target.value as NotesFilter)}
            >
              {filters.map(([v, l]) => (
                <option
                  key={v}
                  value={v}
                >
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.search}>
          <Search size={18} />
          <input
            value={notes.notebookQuery}
            onChange={(e) => notes.setNotebookQuery(e.target.value)}
            placeholder="Search notebooks..."
          />
          <span>⌘K</span>
        </label>
        <Section title="Notebooks">
          <div className={styles.bookList}>
            {notes.data.notebooks.length ? (
              notes.data.notebooks.map((book) => (
                <Notebook
                  key={book.id}
                  book={book}
                  active={selected?.id}
                  selectedBookId={notes.state!.selectedNotebookId}
                  actions={notes.actions}
                  setMenu={setMenu}
                  menu={menu}
                  editingNotebookId={editingNotebookId}
                  setEditingNotebookId={setEditingNotebookId}
                  editingNoteId={editingNoteId}
                  setEditingNoteId={setEditingNoteId}
                />
              ))
            ) : (
              <Empty
                label="No matching notes"
                action="Clear filter"
                onClick={() => notes.actions.setFilter('all')}
              />
            )}
          </div>
        </Section>
        <nav className={styles.nav}>
          <button onClick={() => notes.actions.setFilter('favorites')}>
            <Star
              size={16}
              fill="#fbbf24"
            />
            Favorites<span>{counts.favorites}</span>
          </button>
          <button onClick={() => notes.actions.setFilter('shared')}>
            <Share2 size={16} />
            Shared with me<span>{counts.shared}</span>
          </button>
          <button onClick={() => notes.actions.setFilter('archived')}>
            <Archive size={16} />
            Archive<span>{counts.archive}</span>
          </button>
        </nav>
      </aside>
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.crumb}>
            <strong>{notes.data.selectedNotebook?.title ?? 'Notebook'}</strong>
            <span>›</span>
            <CanvasSwitcher
              open={canvasSwitcherOpen}
              onToggle={(event) => {
                event.stopPropagation();
                setCanvasSwitcherOpen((open) => !open);
              }}
              onClose={() => setCanvasSwitcherOpen(false)}
              notes={
                notes.data.selectedNotebook
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
            />
          </div>
          <div className={styles.actions}>
            <label className={styles.topSelect}>
              <SortAsc size={16} />
              <select
                aria-label="Sort canvases"
                value={notes.state.noteSort}
                onChange={(e) => notes.actions.setNoteSort(e.target.value as NotesSort)}
              >
                {sorts.map(([v, l]) => (
                  <option
                    key={v}
                    value={v}
                  >
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => setShareOpen(true)}>
              <Share2 size={16} />
              Share
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenu('more');
              }}
            >
              <MoreHorizontal size={18} />
            </button>
            <button
              className={styles.presentBtn}
              onClick={() => setPresenting(true)}
            >
              <Presentation size={16} />
              Present
            </button>
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
        <label className={styles.canvasSearch}>
          <Search size={18} />
          <input
            value={notes.noteQuery}
            onChange={(e) => notes.setNoteQuery(e.target.value)}
            placeholder={`Search in ${notes.data.selectedNotebook?.title ?? 'notebook'} canvas...`}
          />
          <span>⌘ F</span>
        </label>
        <div className={styles.format}>
          <select onChange={(e) => cmd('formatBlock', e.target.value)}>
            <option value="H2">H2</option>
            <option value="H1">H1</option>
            <option value="P">Text</option>
          </select>
          <button onClick={() => cmd('bold')}>
            <Bold />
          </button>
          <button onClick={() => cmd('italic')}>
            <Italic />
          </button>
          <button onClick={() => cmd('underline')}>
            <Underline />
          </button>
          <button onClick={() => cmd('formatBlock', 'PRE')}>
            <Code />
          </button>
          <button onClick={() => cmd('insertUnorderedList')}>
            <List />
          </button>
          <button onClick={() => cmd('insertOrderedList')}>
            <ListOrdered />
          </button>
          <button onClick={() => cmd('insertHTML', '<label><input type="checkbox"/> Task</label>')}>
            <CheckSquare />
          </button>
          <button onClick={addLink}>
            <Link />
          </button>
        </div>
        <article className={styles.canvas}>
          {selected ? (
            <>
              <input
                className={styles.titleInput}
                value={selected.title}
                onChange={(e) =>
                  notes.actions.patchNote(selected.id, {
                    title: e.target.value,
                  })
                }
              />
              <div
                ref={editorRef}
                className={styles.editor}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) =>
                  notes.actions.patchNote(selected.id, {
                    body: e.currentTarget.innerHTML,
                  })
                }
              />
            </>
          ) : (
            <Empty
              label={
                notes.data.selectedNotebook ? 'No notes in this notebook' : 'No notebook selected'
              }
              action="New note"
              onClick={() => notes.actions.createNote()}
            />
          )}
        </article>
        <div className={styles.bottomTools}>
          {[MousePointer2, Type, Copy, Link, CheckSquare, Search, MoreHorizontal].map((I, i) => (
            <button
              key={i}
              onClick={coming}
            >
              <I size={20} />
            </button>
          ))}
        </div>
        <div className={styles.zoom}>
          <button onClick={coming}>−</button>
          <span>100%</span>
          <button onClick={coming}>+</button>
          <Lock size={16} />
        </div>
      </section>
      {shareOpen && selected && (
        <ShareModal
          note={selected}
          onClose={() => setShareOpen(false)}
          onSave={(patch) => notes.actions.patchNote(selected.id, patch)}
        />
      )}{' '}
      {notes.toast && (
        <div className={styles.toast}>
          {notes.toast}
          <button onClick={notes.undo}>Undo</button>
        </div>
      )}
    </main>
  );
}
