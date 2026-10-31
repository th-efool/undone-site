'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { SourceIcon, type SourceIconKind } from './SourceIcon';
import styles from './LinkRows.module.css';

export interface ComposerLinkItem {
  id: string;
  url: string;
  title?: string;
  kind: SourceIconKind;
  status: 'idle' | 'extracting' | 'ready' | 'error';
  error?: string;
}

export interface LinkRowsProps {
  links: ComposerLinkItem[];
  onAddLink: (url: string) => void;
  onRemoveLink: (id: string) => void;
  maxLinks?: number;
  disabled?: boolean;
  className?: string;
}

export function formatUrlForDisplay(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
  } catch {
    return rawUrl;
  }
}

export const LinkRows: React.FC<LinkRowsProps> = ({
  links,
  onAddLink,
  onRemoveLink,
  maxLinks = 20,
  disabled = false,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitLink = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      onAddLink(trimmed);
      setInputValue('');
    },
    [onAddLink]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitLink(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && links.length > 0) {
      e.preventDefault();
      const last = links[links.length - 1];
      onRemoveLink(last.id);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;

    // Check if pasted content contains multiple lines or URLs
    const tokens = pasted
      .split(/[\r\n\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && (t.startsWith('http://') || t.startsWith('https://') || t.includes('.')));

    if (tokens.length > 1) {
      e.preventDefault();
      const available = maxLinks - links.length;
      const toAdd = tokens.slice(0, Math.max(0, available));
      toAdd.forEach((t) => onAddLink(t));
      setInputValue('');
    }
  };

  const isAtLimit = links.length >= maxLinks;

  return (
    <div className={`${styles.linkRowsContainer} ${className}`} data-testid="link-rows-container">
      {links.length > 0 && (
        <ul className={styles.linkList} aria-label="Added links">
          {links.map((item) => (
            <li key={item.id} className={styles.linkItem} data-testid={`link-item-${item.id}`}>
              <div className={styles.linkInfo}>
                <div className={styles.iconWrapper}>
                  <SourceIcon kind={item.kind} size={18} />
                </div>
                <div className={styles.linkText}>
                  <span className={styles.linkTitle} title={item.title || item.url}>
                    {item.title || formatUrlForDisplay(item.url)}
                  </span>
                  {item.title && (
                    <span className={styles.linkUrl} title={item.url}>
                      {formatUrlForDisplay(item.url)}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.itemActions}>
                {item.status === 'extracting' && (
                  <span className={styles.statusIndicator} title="Extracting contents...">
                    <span className={styles.statusSpinner} aria-label="Extracting" />
                  </span>
                )}
                {item.status === 'ready' && (
                  <span className={styles.statusIndicator} title="Extracted and ready">
                    <Check size={14} color="#10B981" aria-label="Ready" />
                  </span>
                )}
                {item.status === 'error' && (
                  <span className={styles.statusIndicator} title={item.error || 'Failed to extract'}>
                    <AlertCircle size={14} color="#EF4444" aria-label="Error" />
                  </span>
                )}

                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => onRemoveLink(item.id)}
                  aria-label={`Remove link ${item.title || item.url}`}
                  disabled={disabled}
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isAtLimit && !disabled && (
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            type="text"
            data-bare-input
            className={styles.urlInput}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              links.length === 0
                ? 'Paste a link and press Enter... (YouTube, Notion, GitHub, Web)'
                : 'Paste next link and press Enter...'
            }
            aria-label="Add link URL"
          />
        </div>
      )}

      {isAtLimit && (
        <div className={styles.limitNotice}>
          Maximum {maxLinks} links reached.
        </div>
      )}
    </div>
  );
};

