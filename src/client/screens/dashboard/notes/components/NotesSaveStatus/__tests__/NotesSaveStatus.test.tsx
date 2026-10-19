// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NotesSaveStatus } from '../NotesSaveStatus';

afterEach(cleanup);

describe('NotesSaveStatus', () => {
  it('renders nothing when state is idle and no syncStatus', () => {
    const { container } = render(
      <NotesSaveStatus state={{ status: 'idle', lastSavedAt: null, isDirty: false, errorMessage: null }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders saving pill when syncStatus is saving', () => {
    render(<NotesSaveStatus syncStatus="saving" />);
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('renders saved pill when syncStatus is saved', () => {
    render(<NotesSaveStatus syncStatus="saved" />);
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('renders offline saved pill when syncStatus is offline', () => {
    render(<NotesSaveStatus syncStatus="offline" />);
    expect(screen.getByText('Saved locally')).toBeTruthy();
  });

  it('renders error pill when syncStatus is error', () => {
    render(<NotesSaveStatus syncStatus="error" />);
    expect(screen.getByText(/Sync failed/i)).toBeTruthy();
  });

  it('renders canvas unsaved changes when state is saving or dirty', () => {
    render(
      <NotesSaveStatus state={{ status: 'saving', lastSavedAt: null, isDirty: true, errorMessage: null }} />,
    );
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('renders canvas saved with timestamp when state is saved', () => {
    render(
      <NotesSaveStatus
        state={{
          status: 'saved',
          lastSavedAt: '2026-10-19T10:00:00.000Z',
          isDirty: false,
          errorMessage: null,
        }}
      />,
    );
    expect(screen.getByText(/Saved/)).toBeTruthy();
  });
});
