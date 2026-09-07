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

let nextColId = 100;

const INITIAL_COLUMNS = [
  { id: 'todo',       label: 'To Do'       },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'review',     label: 'Review'      },
  { id: 'done',       label: 'Done'        },
];

const INITIAL_CARDS: any[] = [];

interface Column { id: string; label: string }

export function NotesKanban({ noteId, notes }: { noteId: string, notes: any }) {
  const note = notes?.state?.notes?.find((n: any) => n.id === noteId);

  const [columns, _setColumns] = useState<Column[]>(note?.kanbanColumns || INITIAL_COLUMNS);
  const [cards, _setCards]     = useState<any[]>(note?.kanbanCards ?? INITIAL_CARDS);

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

  /* ── Intercept double-click (desktop) + double-tap (mobile) for rename ── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const triggerRename = (target: Element) => {
      const titleEl = target.closest('.wx-title');
      const colEl   = target.closest('[data-col-id]') as HTMLElement | null;
      if (!titleEl || !colEl) return;
      
      // Don't trigger if they clicked an input or button inside the title
      if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'button' || target.closest('button')) return;

      const colId = colEl.dataset.colId;
      if (!colId) return;
      const col = columns.find(c => c.id === colId);
      if (!col) return;
      setEditingColId(colId);
      setEditingColVal(col.label);
    };

    const dblClickHandler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.tagName.toLowerCase() === 'input') return;
      e.preventDefault();
      triggerRename(target);
    };

    // Mobile: detect two taps within 300ms on the same column title
    let lastTapTarget: Element | null = null;
    let lastTapTime = 0;
    const touchEndHandler = (e: TouchEvent) => {
      const now = Date.now();
      const target = e.target as Element;
      if (target.tagName.toLowerCase() === 'input') return;

      if (now - lastTapTime < 300 && lastTapTarget === target.closest('.wx-title')) {
        e.preventDefault();
        triggerRename(target);
      }
      lastTapTarget = target.closest('.wx-title');
      lastTapTime = now;
    };

    wrapper.addEventListener('dblclick', dblClickHandler);
    wrapper.addEventListener('touchend', touchEndHandler, { passive: false });
    return () => {
      wrapper.removeEventListener('dblclick', dblClickHandler);
      wrapper.removeEventListener('touchend', touchEndHandler);
    };
  }, [columns]);

  /* ── Native dragging (SVAR handles touch natively, removing custom pointer intercept to fix mobile) ── */


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
    const id = `col_${++nextColId}_${Date.now()}`;
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

  const deleteColumn = useCallback((colId: string) => {
    setColumns((prev: any[]) => prev.filter(c => c.id !== colId));
    setCards((prev: any[]) => prev.filter(c => c.column !== colId));
  }, []);

  /* ── Add card to column ── */
  const addCard = useCallback((colId: string) => {
    const id = Date.now();
    const card = { id, column: colId, label: '', description: '', type: 'Task', priority: 'medium', updatedAt: new Date().toISOString(), isNew: true };
    setEditorCard(card);
    setEditorAnchor(null); // center-screen fallback
  }, []);

  const columnCss = (_cards: any[], column: any): string =>
    colCssMap[column.id as string] ?? 'sqhq-col-custom';

  return (
    <div className={`${styles.kanbanContainer} sqhq-kanban-wrapper`} ref={wrapperRef}>

      <WillowDark>
        <div className="sqhq-board-row">
          {/* Inject data-col-id on each column for our dblclick handler and custom add button */}
          <ColIdInjector 
            columns={columns} 
            onAddCard={addCard} 
            onDeleteCol={deleteColumn}
            editingColId={editingColId}
            editingColVal={editingColVal}
            setEditingColVal={setEditingColVal}
            commitColRename={commitColRename}
            cancelColRename={() => setEditingColId(null)}
          />

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
            <button
              className="sqhq-add-col-btn"
              onClick={addColumn}
              onTouchEnd={(e) => {
                // Ensure immediate execution on mobile
                e.preventDefault();
                addColumn();
              }}
            >
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

import { createPortal } from 'react-dom';

function ColIdInjector({ 
  columns, 
  onAddCard, 
  onDeleteCol,
  editingColId,
  editingColVal,
  setEditingColVal,
  commitColRename,
  cancelColRename
}: { 
  columns: Column[], 
  onAddCard: (colId: string) => void,
  onDeleteCol: (colId: string) => void,
  editingColId: string | null,
  editingColVal: string,
  setEditingColVal: (val: string) => void,
  commitColRename: () => void,
  cancelColRename: () => void
}) {
  const [headers, setHeaders] = useState<{ id: string, el: HTMLElement, titleEl: HTMLElement }[]>([]);

  useEffect(() => {
    // Wait a tick for SVAR to render columns
    const timer = setTimeout(() => {
      const colEls = document.querySelectorAll<HTMLElement>('.sqhq-kanban-wrapper .wx-column');
      const newHeaders: typeof headers = [];
      
      colEls.forEach((el, idx) => {
        const col = columns[idx];
        if (col) {
          el.dataset.colId = col.id;
          const header = el.querySelector('.wx-column-header') as HTMLElement;
          const titleEl = el.querySelector('.wx-title') as HTMLElement;
          if (header && titleEl) {
            newHeaders.push({ id: col.id, el: header, titleEl });
            
            // Clean up old native title if editing
            if (editingColId === col.id) {
              titleEl.style.display = 'none';
            } else {
              titleEl.style.display = '';
            }
          }
        }
      });
      setHeaders(newHeaders);
    }, 50);
    return () => clearTimeout(timer);
  });

  return (
    <>
      {headers.map(({ id, el, titleEl }) => {
        const isEditing = editingColId === id;
        return createPortal(
          <div className="sqhq-custom-header-actions" style={{ display: 'flex', alignItems: 'center', position: 'absolute', right: '8px', top: '12px' }}>
            <button
              className="sqhq-custom-add-btn"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAddCard(id); }}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onAddCard(id); }}
              title="Add Card"
            >
              +
            </button>
            <button
              className="sqhq-custom-del-btn"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteCol(id); }}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteCol(id); }}
              title="Delete Column"
            >
              ×
            </button>
          </div>,
          el
        );
      })}
      {headers.map(({ id, titleEl }) => {
        if (editingColId === id) {
          return createPortal(
            <input
              autoFocus
              className="sqhq-col-rename-input"
              value={editingColVal}
              onChange={(e) => setEditingColVal(e.target.value)}
              onBlur={commitColRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitColRename();
                if (e.key === 'Escape') cancelColRename();
              }}
              style={{ width: '100%', padding: '2px 4px', background: 'transparent', color: 'inherit', border: '1px solid #4a4a5a', borderRadius: '4px', outline: 'none' }}
            />,
            titleEl.parentElement! // Inject next to titleEl
          );
        }
        return null;
      })}
    </>
  );
}
