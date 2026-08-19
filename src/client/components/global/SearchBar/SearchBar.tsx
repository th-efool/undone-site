'use client';

import { Search, X } from 'lucide-react';

import { PillInput } from '../PillInput';
import { useCommandContext } from '../CommandPalette';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
import styles from './SearchBar.module.css';

export interface SearchBarProps {
  value?: string;
  placeholder?: string;

  onChange?(value: string): void;
  onSubmit?(): void;
  onClear?(): void;

  className?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
  hideShortcut?: boolean;
}

export function SearchBar({
  value = '',
  placeholder = 'Search topics, creators, playlists, skills...',
  onChange,
  onSubmit,
  className,
  onClear,
  leftIcon,
  rightAction,
  hideShortcut,
}: SearchBarProps) {
  const { openCommand } = useCommandContext();

  return (
    <form
      className={`${styles.searchBar} ${className ?? ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <PillInput
        className={styles.inputShell}
        type="search"
        value={value}
        placeholder={placeholder}
        leftSlot={
          leftIcon || (
            <Search
              size={18}
              strokeWidth={2.2}
              className={styles.icon}
            />
          )
        }
        rightSlot={
          rightAction ? (
            rightAction
          ) : value ? (
            <Tooltip content="Clear search" placement="top">
              <button
                type="button"
                className={styles.clear}
                aria-label="Clear search"
                onClick={() => {
                  onChange?.('');
                  onClear?.();
                }}
              >
                <X size={15} />
              </button>
            </Tooltip>
          ) : !hideShortcut ? (
            <kbd
              className={styles.shortcut}
              role="button"
              tabIndex={0}
              onClick={() => openCommand()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openCommand();
                }
              }}
            >
              ⌘ K
            </kbd>
          ) : null
        }
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onChange?.('');
            onClear?.();
          }
        }}
      />
    </form>
  );
}
