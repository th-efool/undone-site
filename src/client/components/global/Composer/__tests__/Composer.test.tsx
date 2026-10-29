// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
import { SourceIcon } from '../SourceIcon';
import { LinkRows, formatUrlForDisplay, ComposerLinkItem } from '../LinkRows';
import { detectSourceKind as detectLinkKind } from '@/src/shared/cohort-builder/source-kind';
import { AttachmentTray, ComposerFileItem } from '../AttachmentTray';

describe('Composer Components', () => {
  describe('SourceIcon', () => {
    it('renders all supported source icon kinds', () => {
      const kinds = ['youtube', 'notion', 'github', 'pdf', 'text', 'web'] as const;
      for (const kind of kinds) {
        const { unmount } = render(<SourceIcon kind={kind} title={`${kind} icon`} />);
        expect(screen.getByTitle(`${kind} icon`)).toBeDefined();
        unmount();
      }
    });

  });

  describe('detectLinkKind and formatUrlForDisplay', () => {
    it('identifies youtube URLs', () => {
      expect(detectLinkKind('https://www.youtube.com/watch?v=123')).toBe('youtube');
      expect(detectLinkKind('https://youtu.be/123')).toBe('youtube');
    });

    it('identifies notion URLs', () => {
      expect(detectLinkKind('https://acme.notion.site/My-Notes')).toBe('notion');
      expect(detectLinkKind('https://www.notion.so/workspace/123')).toBe('notion');
    });

    it('identifies github URLs', () => {
      expect(detectLinkKind('https://github.com/facebook/react')).toBe('github');
    });

    it('identifies pdf URLs', () => {
      expect(detectLinkKind('https://example.com/document.pdf')).toBe('pdf');
    });

    it('identifies general web URLs', () => {
      expect(detectLinkKind('https://developer.mozilla.org/en-US/')).toBe('web');
    });

    it('formats URLs cleanly for display', () => {
      expect(formatUrlForDisplay('https://github.com/facebook/react')).toBe('github.com/facebook/react');
      expect(formatUrlForDisplay('https://example.com/')).toBe('example.com');
    });
  });

  describe('LinkRows', () => {
    const mockLinks: ComposerLinkItem[] = [
      {
        id: '1',
        url: 'https://youtube.com/watch?v=123',
        title: 'React 19 Deep Dive',
        kind: 'youtube',
        status: 'ready',
      },
      {
        id: '2',
        url: 'https://notion.site/notes',
        title: 'Project Notes',
        kind: 'notion',
        status: 'extracting',
      },
    ];

    it('renders the list of links with title, icon and removal', () => {
      const onAdd = vi.fn();
      const onRemove = vi.fn();

      render(<LinkRows links={mockLinks} onAddLink={onAdd} onRemoveLink={onRemove} />);

      expect(screen.getByText('React 19 Deep Dive')).toBeDefined();
      expect(screen.getByText('Project Notes')).toBeDefined();

      const removeBtns = screen.getAllByRole('button', { name: /remove link/i });
      expect(removeBtns.length).toBe(2);

      fireEvent.click(removeBtns[0]);
      expect(onRemove).toHaveBeenCalledWith('1');
    });

    it('commits link and clears input on Enter key', () => {
      const onAdd = vi.fn();
      const onRemove = vi.fn();

      render(<LinkRows links={[]} onAddLink={onAdd} onRemoveLink={onRemove} />);

      const input = screen.getByLabelText('Add link URL') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'https://github.com/th-efool/repo' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(onAdd).toHaveBeenCalledWith('https://github.com/th-efool/repo');
      expect(input.value).toBe('');
    });

    it('removes last link on Backspace when input is empty', () => {
      const onAdd = vi.fn();
      const onRemove = vi.fn();

      render(<LinkRows links={mockLinks} onAddLink={onAdd} onRemoveLink={onRemove} />);

      const input = screen.getByLabelText('Add link URL');
      fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace' });

      expect(onRemove).toHaveBeenCalledWith('2');
    });

    it('splits pasted multi-line URLs into multiple rows', () => {
      const onAdd = vi.fn();
      const onRemove = vi.fn();

      render(<LinkRows links={[]} onAddLink={onAdd} onRemoveLink={onRemove} />);

      const input = screen.getByLabelText('Add link URL');
      const pastedText = 'https://youtu.be/aaa\nhttps://youtu.be/bbb\nhttps://youtu.be/ccc';

      fireEvent.paste(input, {
        clipboardData: {
          getData: () => pastedText,
        },
      });

      expect(onAdd).toHaveBeenCalledTimes(3);
      expect(onAdd).toHaveBeenCalledWith('https://youtu.be/aaa');
      expect(onAdd).toHaveBeenCalledWith('https://youtu.be/bbb');
      expect(onAdd).toHaveBeenCalledWith('https://youtu.be/ccc');
    });

    it('enforces maximum link limit', () => {
      const onAdd = vi.fn();
      const onRemove = vi.fn();

      render(<LinkRows links={mockLinks} onAddLink={onAdd} onRemoveLink={onRemove} maxLinks={2} />);

      expect(screen.queryByLabelText('Add link URL')).toBeNull();
      expect(screen.getByText(/Maximum 2 links reached/i)).toBeDefined();
    });
  });

  describe('AttachmentTray', () => {
    const mockFiles: ComposerFileItem[] = [
      {
        id: 'f1',
        name: 'Lecture_Notes.pdf',
        size: 1024 * 500, // 500KB
        type: 'application/pdf',
        thumbnailUrl: 'data:image/png;base64,mock',
        status: 'ready',
      },
      {
        id: 'f2',
        name: 'extracting_doc.pdf',
        size: 1024 * 1024, // 1MB
        type: 'application/pdf',
        status: 'extracting',
      },
    ];

    it('renders file tiles matching Reference Image 1 specifications', () => {
      const onRemove = vi.fn();
      render(<AttachmentTray files={mockFiles} onRemoveFile={onRemove} />);

      expect(screen.getByText('Lecture_Notes.pdf')).toBeDefined();
      expect(screen.getByText('extracting_doc.pdf')).toBeDefined();

      // Check PDF badges
      const badges = screen.getAllByText('PDF');
      expect(badges.length).toBe(2);

      // Check thumbnail image
      const img = screen.getByAltText('Preview of Lecture_Notes.pdf');
      expect(img.getAttribute('src')).toBe('data:image/png;base64,mock');

      // Check extracting spinner
      expect(screen.getByLabelText('Processing document...')).toBeDefined();

      // Check remove buttons
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      expect(removeButtons.length).toBe(2);

      fireEvent.click(removeButtons[0]);
      expect(onRemove).toHaveBeenCalledWith('f1');
    });

    it('renders null when file list is empty', () => {
      const { container } = render(<AttachmentTray files={[]} onRemoveFile={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });
  });
});

