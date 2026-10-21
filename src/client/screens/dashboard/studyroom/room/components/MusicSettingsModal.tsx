'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Music2,
  Link2,
  UploadCloud,
  Lock,
  MoreHorizontal,
  X,
  Music,
} from 'lucide-react';
import type { MusicSource } from '../../types';
import {
  parseMusicUrl,
  MUSIC_ERROR_MESSAGES,
  type MusicParseErrorReason,
} from '../../utils/parseMusicUrl';
import styles from './MusicSettingsModal.module.css';

export interface QueueItem {
  id?: string;
  title: string;
  subtitle: string;
  artworkUrl?: string;
  isPlaying?: boolean;
}

export interface MusicSettingsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  music?: MusicSource | null;
  onSetMusic?: (source: MusicSource | null) => void;
  onClearQueue?: () => void;
  onUploadAudio?: (file: File) => void;
  onNotify?: (text: string) => void;
  queue?: QueueItem[];
}

const DEFAULT_QUEUE: QueueItem[] = [
  {
    id: 'fireplace-ambience',
    title: 'Fireplace Ambience',
    subtitle: 'by Undone · 45:12',
    artworkUrl: '/images/studyrooms/scenes/fireplace.webp',
    isPlaying: true,
  },
];

export function MusicSettingsModal({
  isOpen = true,
  onClose,
  music,
  onSetMusic,
  onClearQueue,
  onUploadAudio,
  onNotify,
  queue: externalQueue,
}: MusicSettingsModalProps) {
  const [linkInput, setLinkInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<QueueItem[]>(externalQueue ?? DEFAULT_QUEUE);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync external queue if provided
  useEffect(() => {
    if (externalQueue !== undefined) {
      setItems(externalQueue);
    }
  }, [externalQueue]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleAddLink = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmed = linkInput.trim();
      if (!trimmed) {
        setError(MUSIC_ERROR_MESSAGES.empty);
        return;
      }

      const result = parseMusicUrl(trimmed);
      if (result.ok) {
        onSetMusic?.(result.source);
        const providerName =
          result.source.provider === 'youtube' ? 'YouTube' : 'Spotify';
        const newItem: QueueItem = {
          id: `queue-${Date.now()}`,
          title: `${providerName} ${result.source.kind.charAt(0).toUpperCase() + result.source.kind.slice(1)}`,
          subtitle: `Added by you · Playing`,
          artworkUrl: '/images/studyrooms/scenes/fireplace.webp',
          isPlaying: true,
        };
        setItems((prev) => [newItem, ...prev]);
        setLinkInput('');
        setError(null);
        onNotify?.('Added to room music.');
      } else {
        setError(MUSIC_ERROR_MESSAGES[result.reason]);
      }
    },
    [linkInput, onSetMusic, onNotify]
  );

  const handleClearQueue = useCallback(() => {
    setItems([]);
    onClearQueue?.();
    onSetMusic?.(null);
    onNotify?.('Queue cleared.');
  }, [onClearQueue, onSetMusic, onNotify]);

  const processFile = useCallback(
    (file: File) => {
      onUploadAudio?.(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const newItem: QueueItem = {
        id: `upload-${Date.now()}`,
        title: cleanName || 'Uploaded audio',
        subtitle: `Local audio · ${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        artworkUrl: '/images/studyrooms/scenes/fireplace.webp',
        isPlaying: true,
      };
      setItems((prev) => [newItem, ...prev]);
      onNotify?.(`Uploaded ${file.name}`);
    },
    [onUploadAudio, onNotify]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset file input so user can pick the same file again if desired
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="presentation"
      data-testid="music-settings-modal-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="music-settings-title"
        aria-describedby="music-settings-desc"
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Music2
              className={styles.headerIcon}
              size={24}
              aria-hidden="true"
            />
            <div className={styles.titleCol}>
              <h2 id="music-settings-title" className={styles.title}>
                Your music
              </h2>
              <p id="music-settings-desc" className={styles.subtitle}>
                Add your own music to the room ambience
              </p>
            </div>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Section 1: Add a link */}
        <section className={styles.section} aria-label="Add a link">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Add a link</h3>
            <span className={styles.sectionSubtitle}>
              Songs, albums, playlists, or mixes
            </span>
          </div>

          <form onSubmit={handleAddLink}>
            <div
              className={`${styles.inputRow} ${error ? styles.inputRowError : ''}`}
            >
              <Link2 size={16} className={styles.linkIcon} aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                id="music-link-input"
                aria-label="Music link input"
                className={styles.input}
                placeholder="Paste a YouTube, Spotify, or playlist link"
                value={linkInput}
                onChange={(e) => {
                  setLinkInput(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {error && (
              <p className={styles.errorText} role="alert">
                {error}
              </p>
            )}

            {/* Supported sources badges */}
            <div className={styles.supportedRow}>
              <span className={styles.supportedLabel}>Supported sources</span>

              {/* YouTube pill */}
              <span className={styles.badge}>
                <svg
                  width="18"
                  height="13"
                  viewBox="0 0 18 13"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect width="18" height="13" rx="3.5" fill="#FF0000" />
                  <polygon points="7,3.5 12.5,6.5 7,9.5" fill="#FFFFFF" />
                </svg>
                <span>YouTube</span>
              </span>

              {/* Spotify pill */}
              <span className={styles.badge}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="8" fill="#1ED760" />
                  <path
                    d="M11.5 10.9c-.1.2-.4.3-.6.1-1.7-1-3.9-1.3-6.4-.7-.3.1-.5-.1-.6-.3-.1-.3.1-.5.3-.6 2.8-.6 5.2-.4 7.2.8.2.2.2.5.1.7zm.8-1.9c-.2.3-.5.4-.8.2-2-1.2-5-1.6-7.3-.9-.3.1-.7-.1-.8-.4-.1-.3.1-.7.4-.8 2.7-.8 6-.4 8.3 1 .3.2.4.6.2.9zm.1-2c-2.4-1.4-6.4-1.6-8.7-.9-.4.1-.8-.1-.9-.5-.1-.4.1-.8.5-.9 2.7-.8 7.1-.6 9.8 1 .4.2.5.7.3 1.1-.2.4-.6.5-1 .2z"
                    fill="#000000"
                  />
                </svg>
                <span>Spotify</span>
              </span>
            </div>

            <button type="submit" className={styles.addBtn}>
              Add to room
            </button>
          </form>
        </section>

        {/* Divider with centered 'or' */}
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or</span>
          <span className={styles.dividerLine} />
        </div>

        {/* Section 2: Upload audio */}
        <section className={styles.section} aria-label="Upload audio">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Upload audio</h3>
            <span className={styles.sectionSubtitle}>
              Add your own audio files
            </span>
          </div>

          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Drop audio files here or browse"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a"
              className={styles.hiddenFileInput}
              onChange={handleFileInputChange}
              tabIndex={-1}
            />
            <UploadCloud size={24} className={styles.uploadIcon} aria-hidden="true" />
            <span className={styles.dropText}>
              Drop audio files here or{' '}
              <span className={styles.browseLink}>browse</span>
            </span>
            <span className={styles.dropSubtext}>MP3, WAV, M4A</span>
          </div>
        </section>

        {/* Section 3: Current queue */}
        <section className={styles.section} aria-label="Current queue">
          <div className={styles.queueHeader}>
            <span className={styles.queueTitle}>Current queue</span>
            {items.length > 0 && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={handleClearQueue}
              >
                Clear queue
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className={styles.emptyQueue}>Queue is empty</div>
          ) : (
            items.map((item, index) => {
              const key = item.id || `item-${index}`;
              const hasImgError = imgError[key];

              return (
                <div key={key} className={styles.queueCard}>
                  <div className={styles.queueItemLeft}>
                    <div className={styles.artworkWrap}>
                      {item.artworkUrl && !hasImgError ? (
                        <img
                          src={item.artworkUrl}
                          alt=""
                          className={styles.artworkImg}
                          onError={() =>
                            setImgError((prev) => ({ ...prev, [key]: true }))
                          }
                        />
                      ) : (
                        <div className={styles.artworkFallback}>
                          <Music size={18} aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className={styles.queueItemInfo}>
                      <span className={styles.queueItemTitle}>
                        {item.title}
                      </span>
                      <span className={styles.queueItemSubtitle}>
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className={styles.queueItemRight}>
                    {item.isPlaying !== false && (
                      <div
                        className={styles.equalizer}
                        aria-label="Playing audio"
                        role="img"
                      >
                        <span className={styles.equalizerBar} />
                        <span className={styles.equalizerBar} />
                        <span className={styles.equalizerBar} />
                        <span className={styles.equalizerBar} />
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.moreBtn}
                      aria-label="More options"
                    >
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Footer note */}
        <footer className={styles.footer}>
          <Lock size={13} className={styles.lockIcon} aria-hidden="true" />
          <span className={styles.footerText}>
            Only you can manage your music
          </span>
        </footer>
      </div>
    </div>
  );
}

export default MusicSettingsModal;
