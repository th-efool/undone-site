'use client';

import React from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { MusicSource } from '../../types';
import styles from './MusicPlayerDock.module.css';

export interface MusicPlayerDockProps {
  music: MusicSource;
  hidden: boolean;
  onToggleHidden: () => void;
}

export function MusicPlayerDock({
  music,
  hidden,
  onToggleHidden,
}: MusicPlayerDockProps) {
  if (hidden) {
    return (
      <aside className={`${styles.dock} ${styles.dockCollapsed}`} aria-label="Music Player Dock">
        <div className={styles.collapsedContent}>
          <span className={styles.collapsedTitle}>Room music</span>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={onToggleHidden}
            aria-label="Show music player"
          >
            <ChevronUp size={14} aria-hidden="true" />
            <span>Show player</span>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.dock} aria-label="Music Player Dock">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Room music</span>
          <span className={styles.providerBadge}>{music.provider}</span>
        </div>

        <button
          type="button"
          className={styles.toggleBtn}
          onClick={onToggleHidden}
          aria-label="Hide music player"
          title="Hide player (stops music for you)"
        >
          <ChevronDown size={14} aria-hidden="true" />
          <span>Hide player</span>
        </button>
      </div>

      {music.provider === 'youtube' ? (
        <iframe
          key={music.embedUrl}
          src={music.embedUrl}
          title="Room music (YouTube)"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
          className={styles.youtubeIframe}
        />
      ) : (
        <iframe
          key={music.embedUrl}
          src={music.embedUrl}
          title="Room music (Spotify)"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className={styles.spotifyIframe}
        />
      )}

      <a
        href={music.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.troubleLink}
      >
        <span>Trouble playing? Open in {music.provider === 'youtube' ? 'YouTube' : 'Spotify'}</span>
        <ExternalLink size={12} style={{ display: 'inline', marginLeft: 4 }} aria-hidden="true" />
      </a>
    </aside>
  );
}

export default MusicPlayerDock;
