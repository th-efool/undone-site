/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlayToolsRail } from '../PlayToolsRail';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlayToolsRail component', () => {
  it('renders Camera, Pen, and Mic tools as strictly disabled placeholders with tooltips', () => {
    render(<PlayToolsRail bookmarked={false} onToggleBookmark={vi.fn()} />);

    // Camera tool
    const cameraBtn = screen.getByRole('button', { name: /capture screen or visual snapshot/i });
    expect(cameraBtn.hasAttribute('disabled')).toBe(true);
    expect(cameraBtn.getAttribute('aria-disabled')).toBe('true');
    expect(cameraBtn.getAttribute('title')).toBe('Capture coming later');

    // Pen / Annotation tool
    const penBtn = screen.getByRole('button', { name: /annotate lesson/i });
    expect(penBtn.hasAttribute('disabled')).toBe(true);
    expect(penBtn.getAttribute('aria-disabled')).toBe('true');
    expect(penBtn.getAttribute('title')).toBe('Notes coming later');

    // Mic tool
    const micBtn = screen.getByRole('button', { name: /record voice note/i });
    expect(micBtn.hasAttribute('disabled')).toBe(true);
    expect(micBtn.getAttribute('aria-disabled')).toBe('true');
    expect(micBtn.getAttribute('title')).toBe('Voice notes coming later');
  });

  it('renders bookmark button as an interactive toggle and fires onToggleBookmark on click', () => {
    const onToggleBookmark = vi.fn();
    const { rerender } = render(
      <PlayToolsRail bookmarked={false} onToggleBookmark={onToggleBookmark} />
    );

    const bookmarkBtn = screen.getByRole('button', { name: /bookmark this chunk/i });
    expect(bookmarkBtn.hasAttribute('disabled')).toBe(false);
    expect(bookmarkBtn.getAttribute('title')).toBe('Bookmark this chunk');

    fireEvent.click(bookmarkBtn);
    expect(onToggleBookmark).toHaveBeenCalledTimes(1);

    // Re-render as bookmarked
    rerender(<PlayToolsRail bookmarked={true} onToggleBookmark={onToggleBookmark} />);
    const activeBookmarkBtn = screen.getByRole('button', { name: /remove bookmark/i });
    expect(activeBookmarkBtn.getAttribute('title')).toBe('Remove bookmark');
  });
});
