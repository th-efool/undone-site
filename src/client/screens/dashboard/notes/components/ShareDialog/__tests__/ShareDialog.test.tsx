// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShareDialog } from '../ShareDialog';
import type { NoteDocument } from '../../../models/notes.models';

afterEach(cleanup);

const mockNote: NoteDocument = {
  id: 'note-123',
  notebookId: 'nb-1',
  title: 'Architecture Review',
  contentType: 'canvas',
  ownerId: null,
  permission: 'editor',
  sharedWith: ['alice@example.com'],
  publicLink: false,
  tags: [],
  favorite: false,
  shared: true,
  archived: false,
  order: 1,
  createdAt: '2026-10-27T00:00:00.000Z',
  updatedAt: '2026-10-27T00:00:00.000Z',
  linkedConceptIds: [],
  linkedResourceIds: [],
  learningPathId: null,
  revision: 1,
};

describe('ShareDialog', () => {
  it('renders with clean title quotes and proper dialog structure', () => {
    render(<ShareDialog note={mockNote} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Share “Architecture Review”')).toBeDefined();
    expect(screen.getByLabelText(/Public link/i)).toBeDefined();
    expect(screen.getByPlaceholderText('teammate@example.com')).toBeDefined();
    expect(screen.getByLabelText('Permission level')).toBeDefined();
    expect(screen.getByText('alice@example.com')).toBeDefined();
  });

  it('renders distinct action button hierarchy', () => {
    render(<ShareDialog note={mockNote} onClose={vi.fn()} onSave={vi.fn()} />);

    const shareBtn = screen.getByRole('button', { name: /Share with user/i });
    const copyBtn = screen.getByRole('button', { name: /Copy Link/i });
    const doneBtn = screen.getByRole('button', { name: /Done/i });

    expect(shareBtn).toBeDefined();
    expect(copyBtn).toBeDefined();
    expect(doneBtn).toBeDefined();

    // Share with user is disabled when email is empty
    expect((shareBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onSave when toggling public link', () => {
    const onSave = vi.fn();
    render(<ShareDialog note={mockNote} onClose={vi.fn()} onSave={onSave} />);

    const checkbox = screen.getByLabelText(/Public link/i);
    fireEvent.click(checkbox);

    expect(onSave).toHaveBeenCalledWith({ publicLink: true });
  });

  it('calls onSave when sharing with new collaborator email', () => {
    const onSave = vi.fn();
    render(<ShareDialog note={mockNote} onClose={vi.fn()} onSave={onSave} />);

    const emailInput = screen.getByPlaceholderText('teammate@example.com');
    fireEvent.change(emailInput, { target: { value: 'bob@example.com' } });

    const shareBtn = screen.getByRole('button', { name: /Share with user/i });
    expect((shareBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(shareBtn);

    expect(onSave).toHaveBeenCalledWith({
      shared: true,
      sharedWith: ['alice@example.com', 'bob@example.com'],
    });
  });

  it('calls onClose when clicking Done', () => {
    const onClose = vi.fn();
    render(<ShareDialog note={mockNote} onClose={onClose} onSave={vi.fn()} />);

    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
