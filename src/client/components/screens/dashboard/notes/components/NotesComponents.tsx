import { BookOpen, ChevronDown, Star } from 'lucide-react';
import { MouseEvent, ReactNode, useState } from 'react';

import { useNotes } from '../hooks/useNotes';
import type { NoteEntity, NotebookListItem, Permission } from '../models/notes.models';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import styles from '../Notes.module.css';

export function CanvasSwitcher({
  open,
  onToggle,
  onClose,
  notes,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onToggle: (event: MouseEvent) => void;
  onClose: () => void;
  notes: NoteEntity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selectedIndex = Math.max(
    0,
    notes.findIndex((note) => note.id === selectedId),
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);

  return (
    <div className={styles.canvasSwitcher}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={styles.canvasSwitchButton}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setFocusIndex((index) => Math.min(notes.length - 1, index + 1));
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setFocusIndex((index) => Math.max(0, index - 1));
          }
          if (event.key === 'Enter' && open && notes[focusIndex]) {
            event.preventDefault();
            onSelect(notes[focusIndex].id);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <strong>{notes.find((note) => note.id === selectedId)?.title ?? 'Canvas'}</strong>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div
          className={styles.canvasMenu}
          role="listbox"
          onClick={(event) => event.stopPropagation()}
        >
          {notes.map((note, index) => (
            <button
              key={note.id}
              type="button"
              role="option"
              aria-selected={note.id === selectedId}
              className={`${note.id === selectedId ? styles.selectedCanvas : ''} ${index === focusIndex ? styles.focusedCanvas : ''}`}
              onMouseEnter={() => setFocusIndex(index)}
              onClick={() => onSelect(note.id)}
            >
              {note.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Empty({
  label,
  action,
  onClick,
}: {
  label: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className={styles.empty}>
      <p>{label}</p>
      <button onClick={onClick}>{action}</button>
    </div>
  );
}

export function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label} placement="top">
      <button
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function RenameInput({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const save = () => {
    const next = draft.trim();
    onSave(next || value);
  };

  return (
    <input
      className={styles.renameInput}
      value={draft}
      autoFocus
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') save();
        if (event.key === 'Escape') onCancel();
      }}
    />
  );
}

function BookRow({
  book,
  onClick,
  actions,
  setMenu,
  menu,
  selected,
  editing,
  setEditing,
}: {
  book: NotebookListItem;
  onClick: () => void;
  actions: ReturnType<typeof useNotes>['actions'];
  setMenu: (menu: string | null) => void;
  menu: string | null;
  selected?: boolean;
  editing: boolean;
  setEditing: (id: string | null) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => event.dataTransfer.setData('book', book.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => actions.moveNotebook(event.dataTransfer.getData('book'), book.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu(book.id);
      }}
      className={`${styles.bookRow} ${selected ? styles.activeBook : ''}`}
      onClick={onClick}
    >
      <span style={{ background: book.color }}>
        <BookOpen size={14} />
      </span>
      <b
        onDoubleClick={(event) => {
          event.stopPropagation();
          setEditing(book.id);
        }}
      >
        {editing ? (
          <RenameInput
            value={book.title}
            onSave={(title) => {
              actions.patchNotebook(book.id, { title });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            {book.title}
            {book.archived && <em className={styles.badge}>Archived</em>}
          </>
        )}
      </b>
      <small>{book.noteCount} canvases</small>
      <button
        onClick={(event) => {
          event.stopPropagation();
          actions.patchNotebook(book.id, { favorite: !book.favorite });
        }}
      >
        <Star
          size={14}
          fill={book.favorite ? '#fbbf24' : 'none'}
        />
      </button>
      {menu === book.id && (
        <Context
          book={book}
          actions={actions}
        />
      )}
    </div>
  );
}

export function Notebook({
  book,
  active,
  selectedBookId,
  actions,
  setMenu,
  menu,
  editingNotebookId,
  setEditingNotebookId,
  editingNoteId,
  setEditingNoteId,
}: {
  book: NotebookListItem;
  active?: string;
  selectedBookId: string | null;
  actions: ReturnType<typeof useNotes>['actions'];
  setMenu: (menu: string | null) => void;
  menu: string | null;
  editingNotebookId: string | null;
  setEditingNotebookId: (id: string | null) => void;
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
}) {
  return (
    <div className={styles.current}>
      <BookRow
        book={book}
        selected={selectedBookId === book.id}
        onClick={() => {
          actions.selectNotebook(book.id);
          actions.patchNotebook(book.id, { collapsed: !book.collapsed });
        }}
        actions={actions}
        setMenu={setMenu}
        menu={menu}
        editing={editingNotebookId === book.id}
        setEditing={setEditingNotebookId}
      />
      {!book.collapsed &&
        book.visibleNotes.map((note) => (
          <button
            key={note.id}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('note', note.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => actions.moveNote(event.dataTransfer.getData('note'), book.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu(note.id);
            }}
            className={active === note.id ? styles.activeNote : styles.noteRow}
            onClick={() => actions.selectNote(note.id)}
          >
            <span />
            <b
              className={styles.noteTitle}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setEditingNoteId(note.id);
              }}
            >
              {editingNoteId === note.id ? (
                <RenameInput
                  value={note.title}
                  onSave={(title) => {
                    actions.patchNote(note.id, { title });
                    setEditingNoteId(null);
                  }}
                  onCancel={() => setEditingNoteId(null)}
                />
              ) : (
                note.title
              )}
            </b>
            <Star
              size={13}
              fill={note.favorite ? '#fbbf24' : 'none'}
              onClick={(event) => {
                event.stopPropagation();
                actions.patchNote(note.id, { favorite: !note.favorite });
              }}
            />
            {menu === note.id && (
              <Menu>
                <button
                  onClick={() =>
                    actions.patchNote(note.id, {
                      title: prompt('Rename note', note.title) || note.title,
                    })
                  }
                >
                  Rename
                </button>
                <button onClick={() => actions.duplicateNote(note.id)}>Duplicate</button>
                <button onClick={() => actions.patchNote(note.id, { favorite: !note.favorite })}>
                  Favorite
                </button>
                <button onClick={() => actions.archiveNote(note.id)}>
                  {note.archived ? 'Restore' : 'Archive'}
                </button>
                <button onClick={() => actions.deleteNote(note.id)}>Delete</button>
              </Menu>
            )}
          </button>
        ))}
      <button
        className={styles.addCanvas}
        onClick={() => actions.createNote(book.id)}
      >
        + New canvas in this notebook
      </button>
    </div>
  );
}

function Context({
  book,
  actions,
}: {
  book: NotebookListItem;
  actions: ReturnType<typeof useNotes>['actions'];
}) {
  return (
    <Menu>
      <button
        onClick={() =>
          actions.patchNotebook(book.id, {
            title: prompt('Rename notebook', book.title) || book.title,
          })
        }
      >
        Rename
      </button>
      <button onClick={() => actions.duplicateNotebook(book.id)}>Duplicate</button>
      <button onClick={() => actions.patchNotebook(book.id, { collapsed: !book.collapsed })}>
        {book.collapsed ? 'Expand' : 'Collapse'}
      </button>
      <button onClick={() => actions.patchNotebook(book.id, { favorite: !book.favorite })}>
        Favorite
      </button>
      <button onClick={() => actions.archiveNotebook(book.id)}>
        {book.archived ? 'Restore' : 'Archive'}
      </button>
      <button onClick={() => actions.deleteNotebook(book.id)}>Delete</button>
    </Menu>
  );
}

export function Menu({ children }: { children: ReactNode }) {
  return (
    <div
      className={styles.menu}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function ShareModal({
  note,
  onClose,
  onSave,
}: {
  note: NoteEntity;
  onClose: () => void;
  onSave: (patch: Partial<NoteEntity>) => void;
}) {
  const [email, setEmail] = useState('');

  return (
    <div className={styles.scrim}>
      <div className={styles.modal}>
        <h2>Share “{note.title}”</h2>
        <label>
          <input
            type="checkbox"
            checked={note.publicLink}
            onChange={(event) => onSave({ publicLink: event.target.checked })}
          />
          Public link
        </label>
        <div className={styles.shareLine}>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
          />
          <select
            value={note.permission}
            onChange={(event) => onSave({ permission: event.target.value as Permission })}
          >
            <option>viewer</option>
            <option>editor</option>
            <option>owner</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (email) onSave({ shared: true, sharedWith: [...note.sharedWith, email] });
            setEmail('');
          }}
        >
          Share with user
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(`${location.origin}/notes/${note.id}`)}
        >
          Copy Link
        </button>
        <button onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
