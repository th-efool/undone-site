// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ColIdInjector } from '@/packages/notes-board/src/NotesKanban/NotesKanban';
import type { Column } from '@/packages/notes-board/src/NotesKanban/NotesKanban';

describe('ColIdInjector', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'sqhq-kanban-wrapper';

    // Mock two SVAR columns inside the wrapper
    container.innerHTML = `
      <div class="wx-column">
        <div class="wx-column-header"><div class="wx-title">To Do</div></div>
      </div>
      <div class="wx-column">
        <div class="wx-column-header"><div class="wx-title">In Progress</div></div>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    cleanup();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  const columns: Column[] = [
    { id: 'todo', label: 'To Do' },
    { id: 'inprogress', label: 'In Progress' },
  ];

  it('injects data-col-id on column elements and appends + button to header', () => {
    const onAddCard = vi.fn();
    render(<ColIdInjector columns={columns} onAddCard={onAddCard} />);

    const cols = container.querySelectorAll<HTMLElement>('.wx-column');
    expect(cols[0].dataset.colId).toBe('todo');
    expect(cols[1].dataset.colId).toBe('inprogress');

    const buttons = container.querySelectorAll<HTMLButtonElement>('.sqhq-custom-add-btn');
    expect(buttons.length).toBe(2);
    expect(buttons[0].innerHTML).toBe('+');
    expect(buttons[0].title).toBe('Add Card');
  });

  it('calls onAddCard with the column id on standard click', () => {
    const onAddCard = vi.fn();
    render(<ColIdInjector columns={columns} onAddCard={onAddCard} />);

    const buttons = container.querySelectorAll<HTMLButtonElement>('.sqhq-custom-add-btn');
    fireEvent.click(buttons[0]);

    expect(onAddCard).toHaveBeenCalledTimes(1);
    expect(onAddCard).toHaveBeenCalledWith('todo');
  });

  it('suppresses synthetic click after touchend within 500ms (mobile double execution fix)', () => {
    const onAddCard = vi.fn();
    render(<ColIdInjector columns={columns} onAddCard={onAddCard} />);

    const buttons = container.querySelectorAll<HTMLButtonElement>('.sqhq-custom-add-btn');
    const firstBtn = buttons[0];

    // User touches button
    fireEvent.touchEnd(firstBtn);
    expect(onAddCard).toHaveBeenCalledTimes(1);
    expect(onAddCard).toHaveBeenCalledWith('todo');

    // Synthetic click occurs 300ms later
    fireEvent.click(firstBtn);
    // onAddCard should NOT have been called a second time
    expect(onAddCard).toHaveBeenCalledTimes(1);
  });

  it('allows click after 500ms elapsed since touchend', () => {
    const onAddCard = vi.fn();
    render(<ColIdInjector columns={columns} onAddCard={onAddCard} />);

    const buttons = container.querySelectorAll<HTMLButtonElement>('.sqhq-custom-add-btn');
    const firstBtn = buttons[0];

    const now = 1000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    fireEvent.touchEnd(firstBtn);
    expect(onAddCard).toHaveBeenCalledTimes(1);

    // Later click after 600ms
    vi.spyOn(Date, 'now').mockReturnValue(now + 600);
    fireEvent.click(firstBtn);
    expect(onAddCard).toHaveBeenCalledTimes(2);
  });

  it('cleans up buttons and listeners upon unmount', () => {
    const onAddCard = vi.fn();
    const { unmount } = render(<ColIdInjector columns={columns} onAddCard={onAddCard} />);

    expect(container.querySelectorAll('.sqhq-custom-add-btn').length).toBe(2);

    unmount();

    expect(container.querySelectorAll('.sqhq-custom-add-btn').length).toBe(0);
  });

  it('cleans up and re-injects when columns change', () => {
    const onAddCard = vi.fn();
    const { rerender } = render(<ColIdInjector columns={columns} onAddCard={onAddCard} />);

    const newColumns: Column[] = [
      { id: 'review', label: 'Review' },
      { id: 'done', label: 'Done' },
    ];

    rerender(<ColIdInjector columns={newColumns} onAddCard={onAddCard} />);

    const cols = container.querySelectorAll<HTMLElement>('.wx-column');
    expect(cols[0].dataset.colId).toBe('review');
    expect(cols[1].dataset.colId).toBe('done');

    // Only 2 buttons exist (no duplicate leaked buttons)
    const buttons = container.querySelectorAll<HTMLButtonElement>('.sqhq-custom-add-btn');
    expect(buttons.length).toBe(2);

    fireEvent.click(buttons[0]);
    expect(onAddCard).toHaveBeenCalledWith('review');
  });
});
