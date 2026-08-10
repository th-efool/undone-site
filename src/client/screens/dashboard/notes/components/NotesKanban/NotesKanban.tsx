'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Kanban, WillowDark } from '@svar-ui/react-kanban';
import '@svar-ui/react-kanban/all.css';
import './kanban-dark.css';
import styles from './NotesKanban.module.css';
import { KanbanCard } from './KanbanCard';
import { CardEditor } from './CardEditor';

/* ── Status dot CSS class per column ── */
const colCssMap: Record<string, string> = {
  todo:        'sqhq-col-todo',
  inprogress:  'sqhq-col-inprogress',
  review:      'sqhq-col-review',
  done:        'sqhq-col-done',
};

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

let nextColId = 100;
let nextCardId = 10;

const INITIAL_COLUMNS = [
  { id: 'todo',       label: 'To Do'       },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'review',     label: 'Review'      },
  { id: 'done',       label: 'Done'        },
];

const INITIAL_CARDS: any[] = [
  { id: 1, column: 'todo',       label: 'Research competitors',    description: 'Analyze top 5 competitors and document key differentiators.', type: 'Research', priority: 'medium', updatedAt: daysAgo(2) },
  { id: 2, column: 'todo',       label: 'Write documentation',     description: 'Draft onboarding guide and API reference for the platform.',   type: 'Docs',     priority: 'low',    updatedAt: daysAgo(3) },
  { id: 3, column: 'inprogress', label: 'Implement Kanban board',  description: 'Integrate SVAR React Kanban with dark theme into Notes.',       type: 'Feature',  priority: 'high',   updatedAt: daysAgo(1) },
  { id: 4, column: 'inprogress', label: 'Design system tokens',    description: 'Define color, spacing, and typography tokens.',                type: 'UI',       priority: 'medium', updatedAt: daysAgo(2) },
  { id: 5, column: 'review',     label: 'Auth flow revamp',        description: 'Improve sign-in and sign-up UX based on user feedback.',        type: 'Auth',     priority: 'high',   updatedAt: daysAgo(4) },
  { id: 6, column: 'done',       label: 'Setup project structure', description: 'Scaffold Next.js app with TypeScript, ESLint, and Prettier.',   type: 'DevOps',   priority: 'low',    updatedAt: daysAgo(6) },
];

interface Column { id: string; label: string }

export function NotesKanban({ noteId, notes }: { noteId: string, notes: any }) {
  const note = notes?.state?.notes?.find((n: any) => n.id === noteId);

  const [columns, _setColumns] = useState<Column[]>(note?.kanbanColumns || INITIAL_COLUMNS);
  const [cards, _setCards]     = useState<any[]>(note?.kanbanCards || INITIAL_CARDS);

  const setColumns = (updater: any) => {
    _setColumns(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (notes?.actions?.patchNote) {
        notes.actions.patchNote(noteId, { kanbanColumns: next });
      }
      return next;
    });
  };

  const setCards = (updater: any) => {
    _setCards(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (notes?.actions?.patchNote) {
        notes.actions.patchNote(noteId, { kanbanCards: next });
      }
      return next;
    });
  };

  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColVal, setEditingColVal] = useState('');
  const [editorCard, setEditorCard]     = useState<any | null>(null);
  const [editorAnchor, setEditorAnchor] = useState<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<any>(null);

  // Sync state if another client updates the note (e.g. from Sidebar or another tab)
  useEffect(() => {
    if (note) {
      if (note.kanbanColumns && note.kanbanColumns !== columns) _setColumns(note.kanbanColumns);
      if (note.kanbanCards && note.kanbanCards !== cards) _setCards(note.kanbanCards);
    }
  }, [note?.kanbanColumns, note?.kanbanCards]);

  /* ── Listen to SVAR internal drag-and-drop / sort events to persist them ── */
  useEffect(() => {
    if (!api) return;
    
    const syncState = () => {
      const state = api.getState();
      const currentCards = api.getCards();
      
      // We check if the internal state actually differs to prevent infinite loops
      // since our setCards will trigger a patchNote which might trigger a re-render
      _setCards(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(currentCards)) {
           if (notes?.actions?.patchNote) notes.actions.patchNote(noteId, { kanbanCards: currentCards });
           return currentCards;
        }
        return prev;
      });

      _setColumns(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(state.columns)) {
           if (notes?.actions?.patchNote) notes.actions.patchNote(noteId, { kanbanColumns: state.columns });
           return state.columns;
        }
        return prev;
      });
    };

    api.on('move-card', syncState);
    api.on('update-card', syncState);
    api.on('add-card', syncState);
    api.on('delete-card', syncState);
    api.on('update-column', syncState);

    return () => {
      // Detach listeners if possible, though setting api handles it usually.
    };
  }, [api, noteId, notes?.actions]);

  /* ── Intercept double-click for rename ── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const dblClickHandler = (e: MouseEvent) => {
      const titleEl = (e.target as Element).closest('.wx-title');
      const colEl   = (e.target as Element).closest('[data-col-id]') as HTMLElement | null;
      if (!titleEl || !colEl) return;
      const colId = colEl.dataset.colId;
      if (!colId) return;
      const col = columns.find(c => c.id === colId);
      if (!col) return;
      e.preventDefault();
      setEditingColId(colId);
      setEditingColVal(col.label);
    };

    wrapper.addEventListener('dblclick', dblClickHandler);
    return () => {
      wrapper.removeEventListener('dblclick', dblClickHandler);
    };
  }, [columns]);

  /* ── Fix text selection during drag ── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) || target.isContentEditable || target.closest('button') || target.closest('input')) {
        return;
      }
      isPointerDown = true;
      startX = e.clientX;
      startY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;
      if (!isDragging) {
        if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
          isDragging = true;
          document.body.classList.add('sqhq-is-dragging');
        }
      }
    };

    const onPointerUpOrCancel = () => {
      isPointerDown = false;
      if (isDragging) {
        isDragging = false;
        document.body.classList.remove('sqhq-is-dragging');
      }
    };

    wrapper.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUpOrCancel);
    window.addEventListener('pointercancel', onPointerUpOrCancel);

    return () => {
      wrapper.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUpOrCancel);
      window.removeEventListener('pointercancel', onPointerUpOrCancel);
      document.body.classList.remove('sqhq-is-dragging');
    };
  }, []);


  /* ── Card menu open: open editor near card ── */
  const handleCardMenu = useCallback((card: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEditorCard(card);
    setEditorAnchor({ x: rect.right + 8, y: rect.top });
  }, []);

  const handleSaveCard = (updated: any) => {
    if (updated.isNew) {
      const { isNew, ...cardToSave } = updated;
      setCards((prev: any[]) => [...prev, cardToSave]);
    } else {
      setCards((prev: any[]) => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    }
    setEditorCard(null);
  };

  /* ── Add column ── */
  const addColumn = () => {
    const id = `col_${++nextColId}`;
    setColumns((prev: any[]) => [...prev, { id, label: 'New Column' }]);
    // Start renaming immediately
    setEditingColId(id);
    setEditingColVal('New Column');
  };

  /* ── Commit column rename ── */
  const commitColRename = () => {
    if (!editingColId) return;
    const trimmed = editingColVal.trim();
    if (trimmed) {
      setColumns((prev: any[]) => prev.map(c => c.id === editingColId ? { ...c, label: trimmed } : c));
    }
    setEditingColId(null);
  };

  /* ── Add card to column ── */
  const addCard = useCallback((colId: string) => {
    const id = ++nextCardId;
    const card = { id, column: colId, label: '', description: '', type: 'Task', priority: 'medium', updatedAt: new Date().toISOString(), isNew: true };
    setEditorCard(card);
    setEditorAnchor(null); // center-screen fallback
  }, []);

  const columnCss = (_cards: any[], column: any): string =>
    colCssMap[column.id as string] ?? 'sqhq-col-custom';

  return (
    <div className={`${styles.kanbanContainer} sqhq-kanban-wrapper`} ref={wrapperRef}>
      {/* Column rename dialog — centered modal */}
      {editingColId && (
        <div className="sqhq-col-rename-backdrop" onClick={commitColRename}>
          <div className="sqhq-col-rename-dialog" onClick={e => e.stopPropagation()}>
            <label className="sqhq-col-rename-label">Rename column</label>
            <input
              className="sqhq-col-rename-input-dialog"
              autoFocus
              value={editingColVal}
              onChange={e => setEditingColVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitColRename();
                if (e.key === 'Escape') setEditingColId(null);
              }}
              onBlur={commitColRename}
            />
            <div className="sqhq-col-rename-hint">Press Enter to save · Esc to cancel</div>
          </div>
        </div>
      )}

      <WillowDark>
        <div className="sqhq-board-row">
          {/* Inject data-col-id on each column for our dblclick handler and custom add button */}
          <ColIdInjector columns={columns} onAddCard={addCard} />

          <Kanban
            init={setApi}
            cards={cards}
            columns={columns}
            columnCss={columnCss}
            cardContent={(props: any) => (
              <KanbanCard
                {...props}
                onMenuClick={(e: React.MouseEvent) => handleCardMenu(props.card, e)}
                onUpdateCard={(id: string | number, updates: any) => {
                  setCards((prev: any[]) => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c));
                }}
              />
            )}
            card={{
              priority:    false,
              deadline:    false,
              progress:    false,
              tags:        false,
              description: false,
              menu:        false,  // we own the 3-dot via cardContent
            }}
          />

          {/* ＋ Add column button — wrapped to prevent flex stretching */}
          <div>
            <button className="sqhq-add-col-btn" onClick={addColumn}>
              <span className="sqhq-add-col-icon">+</span>
              <span className="sqhq-add-col-label">Add column</span>
            </button>
          </div>
        </div>
      </WillowDark>

      {editorCard && (
        <CardEditor
          card={editorCard}
          anchor={editorAnchor}
          mode={editorCard.isNew ? 'create' : 'edit'}
          onSave={handleSaveCard}
          onClose={() => setEditorCard(null)}
        />
      )}
    </div>
  );
}

/**
 * Injects `data-col-id` attributes onto SVAR column DOM nodes
 * and a custom Add button to bypass SVAR native card addition.
 */
function ColIdInjector({ columns, onAddCard }: { columns: Column[], onAddCard: (colId: string) => void }) {
  useEffect(() => {
    const colEls = document.querySelectorAll<HTMLElement>('.sqhq-kanban-wrapper .wx-column');
    colEls.forEach((el, idx) => {
      const col = columns[idx];
      if (col) {
        el.dataset.colId = col.id;
        
        const header = el.querySelector('.wx-column-header');
        if (header && !header.querySelector('.sqhq-custom-add-btn')) {
          const addBtn = document.createElement('button');
          addBtn.className = 'sqhq-custom-add-btn';
          addBtn.innerHTML = '+';
          addBtn.title = 'Add Card';
          addBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            onAddCard(col.id);
          };
          header.appendChild(addBtn);
        }
      }
    });
  });
  return null;
}
