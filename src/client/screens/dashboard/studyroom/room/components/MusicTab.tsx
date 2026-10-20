'use client';

import React, { useRef, useState } from 'react';
import { ExternalLink, Music, Trash2 } from 'lucide-react';
import type { MusicSource } from '../../types';
import {
  MUSIC_ERROR_MESSAGES,
  parseMusicUrl,
  type MusicParseErrorReason,
} from '../../utils/parseMusicUrl';
import styles from './MusicTab.module.css';

export interface MusicTabProps {
  music: MusicSource | null;
  onSet: (source: MusicSource | null) => void;
  onNotify: (text: string) => void;
}

export function MusicTab({ music, onSet, onNotify }: MusicTabProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<MusicParseErrorReason | null>(null);
  const currentCardHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = parseMusicUrl(inputValue);

    if (result.ok) {
      onSet(result.source);
      setInputValue('');
      setError(null);
      onNotify('Room music set.');
      requestAnimationFrame(() => {
        currentCardHeadingRef.current?.focus();
      });
    } else {
      setError(result.reason);
    }
  };

  const formatKind = (kind: string) => {
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  };

  return (
    <div className={styles.container}>
      {/* URL Entry Form */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label htmlFor="room-music-url" className={styles.label}>
            YouTube or Spotify link
          </label>
          <div className={styles.inputRow}>
            <input
              id="room-music-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={300}
              placeholder="Paste a YouTube or Spotify link"
              className={`${styles.input} ${error ? styles.inputError : ''}`}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'music-error-hint' : undefined}
            />
            <button type="submit" className={styles.submitBtn}>
              Set room music
            </button>
          </div>
          {error && (
            <p id="music-error-hint" className={styles.errorText} role="alert">
              {MUSIC_ERROR_MESSAGES[error]}
            </p>
          )}
        </div>
      </form>

      {/* Current Active Music Source Card */}
      {music && (
        <div className={styles.currentCard}>
          <div className={styles.cardHeader}>
            <span className={styles.providerBadge}>
              <Music size={12} aria-hidden="true" />
              <span>{music.provider}</span>
            </span>
            <h4
              ref={currentCardHeadingRef}
              tabIndex={-1}
              style={{ margin: 0, outline: 'none' }}
              className={styles.cardDetails}
            >
              {formatKind(music.kind)} · …{music.id.slice(-6)}
            </h4>
          </div>

          <div className={styles.cardActions}>
            <a
              href={music.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.externalLink}
            >
              <span>Open in {music.provider === 'youtube' ? 'YouTube' : 'Spotify'}</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>

            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onSet(null)}
              aria-label="Remove music"
            >
              <Trash2 size={12} aria-hidden="true" />
              <span>Remove music</span>
            </button>
          </div>
        </div>
      )}

      {/* Limitations note */}
      <div className={styles.limitationsSection}>
        <h5 className={styles.limitationsTitle}>Playback details</h5>
        <ul className={styles.limitationsList}>
          <li>
            Playback happens in the embedded player. Your browser blocks autoplay, so everyone presses play in the player.
          </li>
          <li>
            Some videos disable embedding or are private; the player will show its own message.
          </li>
          <li>
            Spotify may play previews unless the listener is signed in to Spotify in this browser.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default MusicTab;
