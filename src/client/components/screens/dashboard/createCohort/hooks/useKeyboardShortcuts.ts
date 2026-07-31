import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  onSearchPalette?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onEscape?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isInput =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable;

      const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      // Cmd+K -> Search palette
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        options.onSearchPalette?.();
        return;
      }

      // Cmd+Shift+Z or Cmd+Y -> Redo
      if (modifier && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault();
        options.onRedo?.();
        return;
      }

      // Cmd+Z -> Undo
      if (modifier && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        options.onUndo?.();
        return;
      }

      // Cmd+D -> Duplicate selected
      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        options.onDuplicate?.();
        return;
      }

      // Cmd+E -> Expand All
      if (modifier && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        options.onExpandAll?.();
        return;
      }

      // Escape
      if (event.key === 'Escape') {
        options.onEscape?.();
        return;
      }

      // Delete (when not editing input)
      if (!isInput && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        options.onDelete?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options]);
}
